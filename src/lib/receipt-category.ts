/**
 * Deterministic category guess for a scanned receipt.
 *
 * The OCR service returns text only (no category), so instead of spending a
 * second model call we match merchant and product words against a small
 * keyword table plus the category names themselves. Returning category 0
 * ("General") is a perfectly good outcome: the user can change it in the form.
 */

type Category = { id: number; grouping: string; name: string }

/**
 * Keyword → category name (`grouping/name`). Keywords are lower-case and are
 * matched as whole words, so "su" does not match "sucuk".
 */
const KEYWORDS: { category: string; words: string[] }[] = [
  {
    category: 'Food and Drink/Groceries',
    words: [
      'market',
      'marketi',
      'migros',
      'bim',
      'a101',
      'sok',
      'şok',
      'carrefour',
      'macro',
      'file',
      'onur',
      'gross',
      'grocery',
      'groceries',
      'supermarket',
      'ekmek',
      'sut',
      'süt',
      'yumurta',
      'peynir',
      'domates',
      'patates',
      'sogan',
      'soğan',
      'meyve',
      'sebze',
      'et',
      'tavuk',
      'makarna',
      'pirinc',
      'pirinç',
      'yag',
      'yağ',
      'seker',
      'şeker',
      'cay',
      'çay',
      'kahve',
      'deterjan',
      'pecete',
      'peçete',
      'sabun',
      'milk',
      'bread',
      'eggs',
      'cheese',
      'tomato',
      'potato',
      'onion',
      'rice',
      'pasta',
      'sugar',
      'coffee',
      'tea',
      'butter',
      'oil',
    ],
  },
  {
    category: 'Food and Drink/Dining Out',
    words: [
      'restaurant',
      'restoran',
      'lokanta',
      'kafe',
      'cafe',
      'café',
      'burger',
      'pizza',
      'dondurma',
      'tatli',
      'tatlı',
      'pastane',
      'firin',
      'fırın',
      'kahvalti',
      'kahvaltı',
      'menü',
      'menu',
      'yemek',
      'diner',
      'coffee shop',
      'starbucks',
      'mcdonald',
    ],
  },
  {
    category: 'Food and Drink/Liquor',
    words: [
      'alkol',
      'biracilik',
      'bira',
      'şarap',
      'sarap',
      'wine',
      'beer',
      'liquor',
    ],
  },
  {
    category: 'Transportation/Taxi',
    words: ['taksi', 'taxi', 'uber', 'bitaksi', 'bi taksi', 'martı', 'marti'],
  },
  {
    category: 'Transportation/Bus/Train',
    words: [
      'otobus',
      'otobüs',
      'metro',
      'tren',
      'train',
      'bus',
      'ulasim',
      'ulaşım',
    ],
  },
  {
    category: 'Transportation/Gas/Fuel',
    words: [
      'benzin',
      'motorin',
      'lpg',
      'petrol',
      'akaryakit',
      'akaryakıt',
      'fuel',
      'shell',
      'opet',
      'petrol ofisi',
    ],
  },
  {
    category: 'Transportation/Parking',
    words: ['otopark', 'parking', 'park'],
  },
  {
    category: 'Home/Rent',
    words: ['kira', 'rent', 'mortgage'],
  },
  {
    category: 'Home/Electronics',
    words: [
      'elektronik',
      'telefon',
      'laptop',
      'bilgisayar',
      'kulaklik',
      'kulaklık',
      'mediamarkt',
      'teknosa',
      'vatan',
    ],
  },
  {
    category: 'Home/Household Supplies',
    words: [
      'temizlik',
      'deterjan',
      'cop torbasi',
      'çöp torbası',
      'hıjyen',
      'hijyen',
      'kagit',
      'kağıt',
      'household',
    ],
  },
  {
    category: 'Home/Pets',
    words: ['mama', 'pet', 'kedi', 'kopek', 'köpek', 'veteriner'],
  },
  {
    category: 'Life/Medical Expenses',
    words: [
      'eczane',
      'pharmacy',
      'hastane',
      'hospital',
      'doktor',
      'doctor',
      'ilac',
      'ilaç',
      'medical',
    ],
  },
  {
    category: 'Life/Clothing',
    words: [
      'giyim',
      'kiyafet',
      'kıyafet',
      'ayakkabi',
      'ayakkabı',
      'clothing',
      'zara',
      'lcwaikiki',
      'hm',
    ],
  },
  {
    category: 'Utilities/Electricity',
    words: ['elektrik', 'electricity', 'enerjisa', 'bedas', 'tedas'],
  },
  {
    category: 'Utilities/Heat/Gas',
    words: ['dogalgaz', 'doğalgaz', 'gaz', 'gas', 'iski', 'fatura'],
  },
]

/**
 * Lower-cases and folds Turkish diacritics to ASCII so that "ŞOK", "sok" and
 * "SOK" all match. The app receives receipts from many devices and OCR engines,
 * and only some of them preserve the dotted/dotless i distinction.
 */
function normalize(value: string): string {
  return (
    value
      .toLowerCase()
      // "İ".toLowerCase() is "i" plus a combining dot in JS.
      .replace(/\u0307/g, '')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/â/g, 'a')
      .replace(/î/g, 'i')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function containsWord(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `)
}

/**
 * Picks the category with the most keyword hits across the merchant name and
 * the product lines. Ties go to the table order (grocery keywords first),
 * because a corner shop selling "ekmek" is more likely groceries than dining.
 */
export function guessReceiptCategoryId(
  text: string,
  categories: Category[],
): number {
  const haystack = normalize(text)
  if (haystack === '') return 0

  let best: { id: number; score: number } | null = null
  for (const entry of KEYWORDS) {
    const category = categories.find(
      (candidate) =>
        `${candidate.grouping}/${candidate.name}` === entry.category,
    )
    if (!category) continue

    const score = entry.words.reduce(
      (sum, word) => sum + (containsWord(haystack, normalize(word)) ? 1 : 0),
      0,
    )
    if (score > 0 && (best === null || score > best.score)) {
      best = { id: category.id, score }
    }
  }

  return best?.id ?? 0
}
