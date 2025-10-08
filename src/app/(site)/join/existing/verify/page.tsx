// src/app/(site)/join/existing/verify/page.tsx
import type { PageProps } from 'next'
import Link from 'next/link'

type SP = Record<string, string | string[] | undefined>

export default async function VerifyPage({ searchParams }: PageProps) {
  const sp = (await searchParams) as SP
  const tokenParam = sp?.token
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam ?? ''

  if (!token) {
    return (
      <section>
        <div className="alert alert--warn">Missing token. Please request a new link.</div>
        <p style={{ marginTop: 12 }}>
          <Link className="hesiLink" href="/">Back to home</Link>
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2>Secure link verified</h2>
      <p className="muted">Continue to the application form.</p>
      <p style={{ marginTop: 12 }}>
        <Link className="hesiLink" href={`/join/existing/apply?token=${encodeURIComponent(token)}`}>
          Open application form
        </Link>
      </p>
    </section>
  )
}
