/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!
const apiVersion = (process.env.SANITY_API_VERSION || '2024-10-01').replace(/^v?/, 'v')
const WRITE = (process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN) as string

function decode(searchParams: URLSearchParams) {
  const postId = searchParams.get('postId')
  const token = searchParams.get('token')
  // Dev: treat token as postId
  if (postId) return { postId }
  if (token) return { postId: token }
  return null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const info = decode(url.searchParams)
    if (!info?.postId) {
      return NextResponse.json({ ok:false, error:'Missing token or postId' }, { status: 400 })
    }

    const client = createClient({ projectId, dataset, apiVersion, token: WRITE, useCdn: false })

    const areas = await client.fetch(
      `*[_type=="priorityArea"] | order(title asc){ _id, title, description }`
    )

    const existing = await client.fetch(
      `*[_type=="priorityMembership" && post._ref==$p]{
        _id,
        "areaId": priorityArea->_id,
        contribution,
        since,
        website,
        status
      }`,
      { p: info.postId }
    )

    return NextResponse.json({ ok:true, postId: info.postId, areas, existing })
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message || 'Prefill failed' }, { status: 500 })
  }
}
