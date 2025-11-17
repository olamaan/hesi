// src/app/dev/submitted/page.tsx
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { serverClient } from '@/sanity/lib/client'

type Row = { _id: string; title: string; datejoined?: string }

export const dynamic = 'force-dynamic'

function fmtDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export default async function SubmittedListPage() {
  noStore()
  if (process.env.NODE_ENV !== 'development') notFound()

  const rows = await serverClient.fetch<Row[]>(
    `*[_type=="post" && lower(status)=="submitted"]
      | order(coalesce(datejoined, _createdAt) desc, title asc){
        _id, title, datejoined
      }`
  )

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ marginBottom: 8 }}>Submitted posts</h1>
      <p style={{ marginTop: 0, color: '#666' }}>
        {rows.length} {rows.length === 1 ? 'result' : 'results'}
      </p>

      {rows.length === 0 ? (
        <p>Nothing to review 🎉</p>
      ) : (
        <ul style={{ lineHeight: 1.6 }}>
          {rows.map((r) => {
            const date = fmtDate(r.datejoined)
            return (
             <li key={r._id}>
  <Link
    href={`/studio/intent/edit/id=${encodeURIComponent(r._id)};type=post`}
    prefetch={false}
    target="_blank"
    rel="noopener noreferrer"
  >
    {r.title || '(untitled)'}
  </Link>
  {date ? <> — <span style={{ color: '#666' }}>{date}</span></> : null}
</li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
