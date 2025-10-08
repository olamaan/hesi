export const dynamic = 'force-dynamic' // or: export const revalidate = 0

import HomeHero from '@/components/HomeHero'

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  return <HomeHero searchParams={searchParams} />
}