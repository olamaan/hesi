// src/app/api/members/lookup/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { apiVersion } from '@/sanity/env' // adjust path if needed

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!

const client = createClient({
  projectId, dataset, apiVersion,
  useCdn: true,
})

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const emailRaw = (searchParams.get('email') || '').trim().toLowerCase()

  if (!emailRaw) {
    return NextResponse.json({ ok: false, error: 'Email required' }, { status: 400 })
  }

  try {
    const matches = await client.fetch(
      `*[
        _type == "post" &&
        lower(status) == "published" &&
        count(emails[lower(@) == $em]) > 0
      ]{
        _id, title,
        "countryTitle": country->title
      }`,
      { em: emailRaw }
    )

    const areas = await client.fetch(
      `*[_type == "priorityArea"]|order(title asc){ _id, title }`
    )

    return NextResponse.json({ ok: true, matches, areas })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Lookup failed' }, { status: 500 })
  }
}
