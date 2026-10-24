import { RecentGroupList } from '@/app/groups/recent-group-list'
import { InstallPwaButton } from '@/components/install-pwa-button'
import { TrackPage } from '@/lib/analytics/track-page'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('Groups')

  return {
    title: t('recent'),
  }
}

export default async function GroupsPage() {
  return (
    <>
      <TrackPage path="/groups" />
      <InstallPwaButton />
      <RecentGroupList />
    </>
  )
}
