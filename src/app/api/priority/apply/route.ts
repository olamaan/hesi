// src/app/api/priority/apply/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { apiVersion } from '@/sanity/env' // adjust import if needed

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!
const token     = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN // write token

const client = createClient({
  projectId, dataset, apiVersion,
  token, useCdn: false,
})

export async function POST(req: Request) {
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing SANITY_WRITE_TOKEN' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected application/json' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const postId = String(body.postId || '').trim()
  const selections = Array.isArray(body.selections) ? body.selections : []

  if (!email || !postId || selections.length === 0) {
    return NextResponse.json({ ok: false, error: 'email, postId, and selections are required' }, { status: 400 })
  }

  try {
    // 1) Validate email belongs to that post
    const post = await client.fetch(
      `*[_type=="post" && _id==$id][0]{ _id, emails }`,
      { id: postId }
    )
    if (!post) {
      return NextResponse.json({ ok: false, error: 'Institution not found' }, { status: 404 })
    }
    const hasEmail = Array.isArray(post.emails)
      && post.emails.some((e: string) => String(e || '').trim().toLowerCase() === email)

    if (!hasEmail) {
      return NextResponse.json({ ok: false, error: 'Email does not match this institution' }, { status: 403 })
    }

    // 2) Normalize selections & skip duplicates
    const created: string[] = []
    const skipped: string[] = []

    for (const sel of selections) {
      const areaId = String(sel.areaId || '').trim()
      const contribution = String(sel.contribution || '').trim()
      const website = sel.website ? String(sel.website).trim() : undefined

      if (!areaId || contribution.length < 10) {
        skipped.push(areaId || '(missing)') // invalid selection
        continue
      }

      const dup = await client.fetch(
        `count(*[_type=="priorityMembership" && post._ref==$p && priorityArea._ref==$a])`,
        { p: postId, a: areaId }
      )
      if (dup > 0) {
        skipped.push(areaId)
        continue
      }

      const doc = {
        _type: 'priorityMembership',
        post: { _type: 'reference', _ref: postId },
        priorityArea: { _type: 'reference', _ref: areaId },
        contribution,
        website: website || undefined,
        since: new Date().toISOString().slice(0, 10),
        status: 'submitted',
      }

      const res = await client.create(doc)
      created.push(res._id)
    }

    return NextResponse.json({ ok: true, created, skipped })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Apply failed' }, { status: 500 })
  }
}
