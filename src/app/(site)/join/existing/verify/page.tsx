// src/app/(site)/join/existing/verify/page.tsx
import Link from 'next/link'

type SP = Record<string, string | string[] | undefined>

export default async function VerifyPage({
  searchParams,
}: {
  searchParams?: Promise<SP>
}) {
  const sp = (await searchParams) ?? {}
  const tokenParam = sp.token
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam ?? ''

  if (!token) {
    return <div className="alert alert--warn">Missing token.</div>
  }

  return (
    <section>
      <h2>Priority Area application</h2>
      <p className="muted">Secure link detected. (Form content will go here.)</p>
      <p style={{ marginTop: 12 }}>
        <Link className="hesiLink" href="/">Back to home</Link>
      </p>
    </section>
  )
}
