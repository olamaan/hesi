import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 })
  }

  const secretStr = process.env.MAGIC_LINK_SECRET || ''
  if (!secretStr) {
    return NextResponse.json({ ok: false, error: 'Server misconfigured (no MAGIC_LINK_SECRET)' }, { status: 500 })
  }

  try {
    const secret = new TextEncoder().encode(secretStr)
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })

    const postId = String(payload.postId || '')
    if (!postId) {
      return NextResponse.json({ ok: false, error: 'Invalid token payload' }, { status: 400 })
    }

    // Redirect to the editable apply page with the resolved postId
    const dest = new URL(`/join/existing/apply?postId=${encodeURIComponent(postId)}`, url)
    return NextResponse.redirect(dest)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid or expired link' }, { status: 400 })
  }
}
