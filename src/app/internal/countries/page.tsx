// src/app/internal/countries/page.tsx
import Link from 'next/link'
import { publicClient as client } from '@/sanity/lib/client'

type CountryStat = {
  _id: string
  title: string
  memberCount: number
}

const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n)

export const metadata = {
  title: 'Members by Country',
}

export default async function MembersByCountryPage() {
  const data = await client.fetch<{
    countries: CountryStat[]
    publishedTotal: number
  }>(
    /* groq */ `
      {
        "countries": *[_type == "country"]{
          _id,
          title,
          "memberCount": count(*[
            _type == "post" &&
            lower(status) == "published" &&
            references(^._id)
          ])
        },

        "publishedTotal": count(*[
          _type == "post" &&
          lower(status) == "published"
        ])
      }
    `,
    {},
    {
      next: { revalidate: 60, tags: ['members-by-country'] },
      cache: 'force-cache',
    },
  )

  const rows = data.countries
    .filter((c) => c.memberCount > 0)
    .sort((a, b) => {
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount
      return a.title.localeCompare(b.title)
    })

  const assignedTotal = rows.reduce((sum, row) => sum + row.memberCount, 0)
  const missingCountry = Math.max(0, data.publishedTotal - assignedTotal)

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="hesiBanner__eyebrow">Internal</div>
        <h1 style={{ margin: '8px 0 10px' }}>Members by country</h1>
        <p className="muted" style={{ maxWidth: 800 }}>
          Distribution of published HESI members across countries.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>{formatNumber(rows.length)}</strong> countries represented ·{' '}
          <strong>{formatNumber(assignedTotal)}</strong> assigned to countries ·{' '}
          <strong>{formatNumber(missingCountry)}</strong> missing country
        </p>
        <p style={{ marginTop: 6 }}>
          <strong>{formatNumber(data.publishedTotal)}</strong> total published members
        </p>
      </div>

      <div className="joinBox" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Country</th>
              <th style={{ ...thStyle, width: '120px', textAlign: 'right' }}>Members</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = `/?q=${encodeURIComponent(row.title)}`

              return (
                <tr key={row._id}>
                  <td style={tdStyle}>
                    <Link href={href} className="webLink">
                      {row.title}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatNumber(row.memberCount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="empty-state">No country data available.</p>}

      {missingCountry > 0 && (
        <p style={{ marginTop: 20 }}>
          {formatNumber(missingCountry)} published members do not currently have a country assigned.
        </p>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px 16px',
  borderBottom: '1px solid #d9e0ea',
  fontSize: 14,
}

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #eef2f7',
  verticalAlign: 'middle',
  fontSize: 15,
}