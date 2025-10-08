// src/app/(site)/join/existing/apply/page.tsx
import Link from 'next/link'

type SP = { [k: string]: string | string[] | undefined }

export default async function ApplyPage({
  searchParams,
}: {
  // Next 15: searchParams may be a Promise in typed props
  searchParams: Promise<SP> | SP
}) {
  // Support both Promise and plain object to be future-proof
  const sp = typeof (searchParams as Promise<SP>).then === 'function'
    ? await (searchParams as Promise<SP>)
    : (searchParams as SP)

  const tokenParam = sp?.token
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam || ''

  return (
    <section>
      <h2>Priority Area application</h2>

      {token ? (
        <p className="muted">
          Secure link detected. (Form content will go here.)
        </p>
      ) : (
        <div className="alert alert--warn">
          Missing token. Please request a new link.
        </div>
      )}

      <p style={{ marginTop: 12 }}>
        <Link className="hesiLink" href="/">Back to home</Link>
      </p>
    </section>
  )
}
