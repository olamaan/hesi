// src/app/(site)/page.tsx
export const revalidate = 60; // cache this page for 60s

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

