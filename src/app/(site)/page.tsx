// src/app/(site)/page.tsx
import type { PageProps } from 'next'
import HomeHero from '@/components/HomeHero'

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams
  return <HomeHero searchParams={sp} />
}
