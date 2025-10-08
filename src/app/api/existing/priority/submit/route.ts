/* eslint-disable @typescript-eslint/no-explicit-any */


import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!
const apiVersion = (process.env.SANITY_API_VERSION || '2024-10-01').replace(/^v?/, 'v')
const WRITE = (process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN) as string

type Selection = {
  areaId: string
  contribution: string
  since?: string | null
  website?: string | null
  membershipId?: string | null
}

export async function POST(req: Request) {
  try {
    if (!/application\/json/i.test(req.headers.get('content-type') || '')) {
      return NextResponse.json({ ok:false, error:'Expected application/json' }, { status: 415 })
    }
    const body = await req.json()
    const postId: string | undefined = body?.postId || body?.token // dev: token carries postId
    const selections: Selection[] = Array.isArray(body?.selections) ? body.selections : []

    if (!postId) return NextResponse.json({ ok:false, error:'Missing postId/token' }, { status: 400 })

    const client = createClient({ projectId, dataset, apiVersion, token: WRITE, useCdn: false })

    // Lookup existing memberships for this post
    const existingRows = await client.fetch(
      `*[_type=="priorityMembership" && post._ref==$p]{ _id, "areaId": priorityArea->_id }`,
      { p: postId }
    )
    const existingByArea: Record<string, string> = {}
    for (const r of existingRows) existingByArea[r.areaId] = r._id

    const tx = client.transaction()
    for (const sel of selections) {
      const base = {
        contribution: sel.contribution,
        since: sel.since || undefined,
        website: sel.website || undefined,
        status: 'submitted',
      }

      const existingId = sel.membershipId || existingByArea[sel.areaId]
      if (existingId) {
        tx.patch(existingId, { set: base })
      } else {
        tx.create({
          _type: 'priorityMembership',
          post: { _type: 'reference', _ref: postId },
          priorityArea: { _type: 'reference', _ref: sel.areaId },
          ...base,
        })
      }
    }

    const result = await tx.commit()
    return NextResponse.json({ ok:true, tx: result })
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message || 'Submit failed' }, { status: 500 })
  }
}
