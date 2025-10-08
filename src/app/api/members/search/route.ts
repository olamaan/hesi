// src/app/api/members/search/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { apiVersion } from '@/sanity/env'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!

const client = createClient({ projectId, dataset, apiVersion, useCdn: true })

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ ok: true, matches: [] })

  const matches = await client.fetch(
    `*[
      _type=="post" && lower(status)=="published" && title match $t
    ]|order(title asc)[0...20]{
      _id, title, "countryTitle": country->title
    }`,
    { t: `${q}*` }
  )

  return NextResponse.json({ ok: true, matches })
}
