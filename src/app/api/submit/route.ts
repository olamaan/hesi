// src/app/api/submit/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { apiVersion } from '@/sanity/env'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || ''
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET || ''
const token     = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN || ''

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

function splitEmails(raw: string) {
  return (raw || '')
    .split(/[,\s;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter((e, i, a) => a.indexOf(e) === i)
}

export async function POST(req: Request) {
  // Ensure env present
  if (!projectId || !dataset || !token) {
    return NextResponse.json(
      { ok: false, error: 'Server env missing (projectId/dataset/token).' },
      { status: 500 }
    )
  }

  // Read form data
  const fd = await req.formData()
  const title      = String(fd.get('title') || '').trim()
  const countryRef = String(fd.get('country') || '').trim()
  const website    = String(fd.get('website') || '').trim()
  const emailOne   = String(fd.get('email') || '').trim()
  const focalpoint = String(fd.get('focalpoint') || '').trim()
  const description= String(fd.get('description') || '').trim()

  if (!title || !countryRef || !emailOne) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields.' },
      { status: 400 }
    )
  }

  // Duplicate check by title (case-insensitive)
  const dup = await client.fetch(
    `count(*[_type=="post" && lower(title)==$t])`,
    { t: title.toLowerCase() }
  )
  if (dup > 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate-title' })
  }

  // Create document
  const doc = {
    _type: 'post',
    title,
    country: { _type: 'reference', _ref: countryRef },
    website: website || undefined,
    emails: splitEmails(emailOne),
    focalpoint: focalpoint || undefined,
    description: description || undefined,
    status: 'submitted',
    datejoined: new Date().toISOString().slice(0, 10),
  }

  const created = await client.create(doc)
  return NextResponse.json({ ok: true, id: created._id })
}
