'use server'
import { getCategories } from '@/lib/api'
import { env } from '@/lib/env'
import { getRuntimeFeatureFlags } from '@/lib/featureFlags'
import { getOpenAIClient } from '@/lib/openai'
import { isAllowedUploadUrl } from '@/lib/uploaded-image-url'
import { formatCategoryForAIPrompt } from '@/lib/utils'
import { z } from 'zod'

// The model is contractually bound to this shape by `strict: true` below, but
// the response is still parsed rather than trusted: a self-hosted or older
// endpoint may ignore the schema.
const receiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
})

const receiptResponseSchema = z.object({
  amount: z.number(),
  categoryId: z.string(),
  date: z.string(),
  title: z.string(),
  merchant: z.string().optional(),
  items: z.array(receiptItemSchema).optional(),
})

export type ReceiptExtractedItem = {
  name: string
  /** As printed on the receipt (fractions allowed for weighed products). */
  quantity: number
  /** Decimal major units, e.g. 12.5 for 12.50 €. Converted by the form. */
  unitPrice: number
}

export async function extractExpenseInformationFromImage(imageUrl: string) {
  'use server'

  // Enforce the feature flag server-side: the UI gate only hides the button, it
  // does not prevent the action endpoint from being invoked directly.
  const { enableReceiptExtract } = await getRuntimeFeatureFlags()
  if (!enableReceiptExtract) {
    throw new Error('Receipt extraction is not enabled.')
  }

  // Only extract from images the app itself uploaded. Without this, an arbitrary
  // caller-supplied URL is forwarded to the model, enabling SSRF-via-OpenAI and
  // unbounded API spend.
  if (!isAllowedUploadUrl(imageUrl)) {
    throw new Error('Invalid image URL.')
  }

  const categories = await getCategories()
  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_MODEL_RECEIPT_EXTRACT,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'receipt_response',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            categoryId: { type: 'string' },
            date: { type: 'string' },
            title: { type: 'string' },
            merchant: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  unitPrice: { type: 'number' },
                },
                required: ['name', 'quantity', 'unitPrice'],
                additionalProperties: false,
              },
            },
          },
          required: [
            'amount',
            'categoryId',
            'date',
            'title',
            'merchant',
            'items',
          ],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
              This image contains a receipt.
              Read the total amount and store it as a non-formatted number without any other text or currency.
              Then guess the category for this receipt among the following categories and store its ID: ${categories.map(
                (category) => formatCategoryForAIPrompt(category),
              )}.
              Guess the expense's date and store it as yyyy-mm-dd.
              Guess a title for the expense, and read the merchant/store name.
              Finally, transcribe every purchased product line into "items". For each line:
              - "name": the product name as printed (short, no prices),
              - "quantity": the number of units, using a decimal number for weighed products (e.g. 1.5 for 1.5 kg),
              - "unitPrice": the price of ONE unit as a decimal number in the receipt currency, without currency symbol.
              If a line only shows a total and no unit price, divide the total by the quantity.
              Skip lines that are not products (subtotal, tax, discount, loyalty points, payment method).
              If no product line can be read, return an empty array.`,
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: imageUrl } }],
      },
    ],
  })

  const messageContent = completion.choices.at(0)?.message.content
  const parsed = (() => {
    if (!messageContent) return null
    try {
      return receiptResponseSchema.parse(JSON.parse(messageContent))
    } catch {
      // Malformed or schema-violating output: report "nothing extracted"
      // rather than passing junk on to the expense form.
      return null
    }
  })()

  const amount = Number(parsed?.amount)
  return {
    amount: Number.isFinite(amount) ? amount : null,
    categoryId: parsed?.categoryId ?? null,
    date: parsed?.date ?? null,
    title: parsed?.title ?? null,
    merchant: parsed?.merchant?.trim() || null,
    items: normalizeExtractedItems(parsed?.items ?? []),
  }
}

/**
 * Keeps only lines that can be turned into an expense item. The model may
 * return zero/negative quantities or absurd prices for decorative lines, and
 * those would make the form invalid before the user ever sees it.
 */
function normalizeExtractedItems(
  items: z.infer<typeof receiptItemSchema>[],
): ReceiptExtractedItem[] {
  return items
    .map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }))
    .filter(
      (item) =>
        item.name.length > 0 &&
        item.name.length <= 200 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 1_000_000 &&
        Number.isFinite(item.unitPrice) &&
        item.unitPrice >= 0 &&
        item.unitPrice <= 10_000_000,
    )
}

export type ReceiptExtractedInfo = Awaited<
  ReturnType<typeof extractExpenseInformationFromImage>
>
