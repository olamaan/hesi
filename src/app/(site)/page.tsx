// src/app/(site)/page.tsx
import HomeHero from '@/components/HomeHero'

type SP = Record<string, string | string[] | undefined>

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SP>
}) {
  const sp = (await searchParams) ?? {}
  return <HomeHero searchParams={sp} />
}

