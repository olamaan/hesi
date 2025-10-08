// src/app/api/submit/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!
const apiVersion = (process.env.SANITY_API_VERSION || '2024-10-01').startsWith('v')
  ? (process.env.SANITY_API_VERSION as string)
  : `v${process.env.SANITY_API_VERSION || '2024-10-01'}`
const token = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN

const norm = (v: unknown) => (v ?? '').toString().trim()
const todayISO = () => new Date().toISOString().slice(0, 10)
const normalizeUrl = (u?: string) => {
  const s = norm(u)
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}
const splitEmails = (raw: unknown): string[] => {
  const s = norm(raw)
  if (!s) return []
  return s
    .split(/[,\s;]+/)
    .map((e) => e.trim())
    .filter((e) => e && e.includes('@'))
    .filter((e, i, arr) => arr.indexOf(e) === i)
}

export async function POST(req: Request) {
  try {
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing SANITY_WRITE_TOKEN' }, { status: 500 })
    }

    const form = await req.formData()

    // Required
    const title = norm(form.get('title'))
    const countryId = norm(form.get('country'))
    if (!title || !countryId) {
      return NextResponse.json({ ok: false, error: 'Missing required fields (title, countryId).' }, { status: 400 })
    }

    // Optional (with fallbacks for common field names)
    const description =
      norm(form.get('description') ?? form.get('desc') ?? form.get('about'))

    const emails = splitEmails(
      form.get('emails') ?? form.get('email') ?? form.get('contactEmail')
    )

    const website = normalizeUrl(norm(form.get('website')))
    const focalpoint = norm(form.get('focalpoint'))

    const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

    // Create Member (post)
    const postDoc: any = {
      _type: 'post',
      title,
      datejoined: todayISO(),
      country: { _type: 'reference', _ref: countryId },
      status: 'submitted',
    }
    if (description) postDoc.description = description
    if (website) postDoc.website = website
    if (emails.length) postDoc.emails = emails
    if (focalpoint) postDoc.focalpoint = focalpoint

    const created = await client.create(postDoc)

    // Optional priority memberships JSON (from hidden <input name="pa">)
    const paRaw = form.get('pa')
    if (paRaw) {
      try {
        const paList: Array<{ areaId?: string; contribution?: string; website?: string }> =
          JSON.parse(norm(paRaw))
        const memberships = (paList || []).filter(
          (m) => m.areaId && norm(m.contribution).length > 0
        )
        if (memberships.length) {
          const tx = client.transaction()
          for (const m of memberships) {
            tx.create({
              _type: 'priorityMembership',
              post: { _type: 'reference', _ref: created._id },
              priorityArea: { _type: 'reference', _ref: norm(m.areaId) },
              contribution: norm(m.contribution),
              since: todayISO(),
              website: normalizeUrl(m.website || ''),
              status: 'submitted',
            })
          }
          await tx.commit()
        }
      } catch {
        // ignore malformed PA JSON so the main submission still succeeds
      }
    }

    return NextResponse.json({ ok: true, id: created._id })
  } catch (err: any) {
    console.error('[submit] error', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
