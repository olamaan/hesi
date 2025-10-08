// src/app/api/sanity-token-check/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const pid = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || ''
  const ds  = process.env.NEXT_PUBLIC_SANITY_DATASET || ''
  const ver = process.env.SANITY_API_VERSION || '2024-10-01'
  const versionPath = ver.startsWith('v') ? ver : `v${ver}`
  const url = `https://${pid}.api.sanity.io/${versionPath}/data/query/${ds}?query=count(*)`

  async function testToken(label: string, raw?: string | null) {
    if (!raw) return { label, present: false }
    const tok = raw.trim()
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
      const body = await res.text()
      return {
        label,
        present: true,
        status: res.status,
        ok: res.ok,
        body,
        length: raw.length,
        trimmedLength: tok.length,
      }
    } catch (e: any) {
      return { label, present: true, error: String(e?.message || e) }
    }
  }

  const write = await testToken('SANITY_WRITE_TOKEN', process.env.SANITY_WRITE_TOKEN)
  const api   = await testToken('SANITY_API_TOKEN',   process.env.SANITY_API_TOKEN)

  return NextResponse.json({ projectHost: url, write, api })
}
