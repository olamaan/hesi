/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { apiVersion } from '@/sanity/env'
import { SignJWT } from 'jose'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!
const token     = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN
const secretStr = process.env.MAGIC_LINK_SECRET || ''
const secret    = new TextEncoder().encode(secretStr)

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

export async function POST(req: Request) {
  if (!secretStr) {
    return NextResponse.json({ ok: false, error: 'Missing MAGIC_LINK_SECRET' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected application/json' }, { status: 400 })
  }

  const postId = String(body.postId || '').trim()
  const email  = String(body.email  || '').trim().toLowerCase()
  if (!postId || !email) {
    return NextResponse.json({ ok: false, error: 'postId and email required' }, { status: 400 })
  }

  // Validate member + email on record
  const post = await client.fetch(
    `*[_type=="post" && _id==$id][0]{ _id, title, emails }`,
    { id: postId }
  )
  if (!post) {
    return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })
  }

  const hasEmail =
    Array.isArray(post.emails) &&
    post.emails.some((e: string) => String(e || '').trim().toLowerCase() === email)

  if (!hasEmail) {
    return NextResponse.json({ ok: false, error: 'That email is not on record for this member.' }, { status: 403 })
  }

  // Build signed token (20 mins)
  const now = Math.floor(Date.now() / 1000)
  const jwt = await new SignJWT({ postId, email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + 20 * 60)
    .sign(secret)

  const base =
    (process.env.PUBLIC_BASE_URL || req.headers.get('origin') || 'http://localhost:3000').replace(/\/$/, '')
  const verifyUrl = `${base}/join/existing/verify?token=${encodeURIComponent(jwt)}`

  // No email provider for now — return preview URL so you can copy/paste it.
  return NextResponse.json({
    ok: true,
    sent: false,
    previewUrl: verifyUrl,
    note: 'Email not sent (no provider configured). Use previewUrl for dev/testing.',
  })
}
