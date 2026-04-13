// src/app/internal/emails/page.tsx
import { publicClient as client } from '@/sanity/lib/client'

type MemberRow = {
  _id: string
  title: string
  emails?: string[]
}

type InvalidEmailEntry = {
  memberId: string
  memberTitle: string
  email: string
}

export const metadata = {
  title: 'Published Member Emails',
}

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px 16px',
  borderBottom: '1px solid #d9e0ea',
  fontSize: 14,
}

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #eef2f7',
  verticalAlign: 'top',
  fontSize: 15,
}

export default async function PublishedMemberEmailsPage() {
  const data = await client.fetch<{
    members: MemberRow[]
    publishedTotal: number
  }>(
    /* groq */ `
      {
        "members": *[
          _type == "post" &&
          lower(status) == "published"
        ]{
          _id,
          title,
          emails
        },

        "publishedTotal": count(*[
          _type == "post" &&
          lower(status) == "published"
        ])
      }
    `,
    {},
    {
      next: { revalidate: 60, tags: ['published-member-emails'] },
      cache: 'force-cache',
    },
  )

  const invalidEmails: InvalidEmailEntry[] = []

  const rows = data.members
    .map((member) => {
      const seenForMember = new Set<string>()

      const cleanedEmails = (member.emails || []).reduce<string[]>((acc, raw) => {
        const normalized = normalizeEmail(String(raw || ''))

        if (!normalized) return acc

        if (!isValidEmail(normalized)) {
          invalidEmails.push({
            memberId: member._id,
            memberTitle: member.title,
            email: raw,
          })
          return acc
        }

        if (seenForMember.has(normalized)) return acc

        seenForMember.add(normalized)
        acc.push(normalized)
        return acc
      }, [])

      return {
        ...member,
        emails: cleanedEmails,
      }
    })
    .filter((member) => member.emails.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title))

  const uniqueEmails = Array.from(new Set(rows.flatMap((row) => row.emails))).sort((a, b) =>
    a.localeCompare(b),
  )

  const membersWithEmail = rows.length
  const missingEmail = data.members.filter((member) => {
    const validEmails = (member.emails || [])
      .map((email) => normalizeEmail(String(email || '')))
      .filter((email) => email && isValidEmail(email))

    return validEmails.length === 0
  }).length

  const uniqueInvalidEmails = Array.from(
    new Map(
      invalidEmails.map((item) => [
        `${item.memberId}::${item.email.toLowerCase()}`,
        item,
      ]),
    ).values(),
  ).sort((a, b) => {
    const byMember = a.memberTitle.localeCompare(b.memberTitle)
    if (byMember !== 0) return byMember
    return a.email.localeCompare(b.email)
  })

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="hesiBanner__eyebrow">Internal</div>
        <h1 style={{ margin: '8px 0 10px' }}>Published member email addresses</h1>
        <p className="muted" style={{ maxWidth: 800 }}>
          Email addresses extracted from published HESI members.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>{uniqueEmails.length}</strong> unique valid email addresses ·{' '}
          <strong>{membersWithEmail}</strong> published members with valid email ·{' '}
          <strong>{missingEmail}</strong> published members with no valid email
        </p>
        <p style={{ marginTop: 6 }}>
          <strong>{uniqueInvalidEmails.length}</strong> invalid email entr
          {uniqueInvalidEmails.length === 1 ? 'y' : 'ies'} excluded
        </p>
        <p style={{ marginTop: 6 }}>
          <strong>{data.publishedTotal}</strong> total published members
        </p>
      </div>

      <div className="joinBox" style={{ padding: 16, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Valid email list</div>
        <textarea
          readOnly
          value={uniqueEmails.join('\n')}
          style={{
            width: '100%',
            minHeight: 420,
            border: '1px solid #d9e0ea',
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: 'monospace',
            resize: 'vertical',
            background: '#fff',
          }}
        />
      </div>

      {uniqueEmails.length === 0 && (
        <p className="empty-state">No valid published member emails found.</p>
      )}

      {uniqueInvalidEmails.length > 0 && (
        <div className="joinBox" style={{ padding: 0, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '16px 16px 0', fontWeight: 600 }}>Excluded invalid emails</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Member</th>
                <th style={thStyle}>Invalid email</th>
              </tr>
            </thead>
            <tbody>
              {uniqueInvalidEmails.map((item, index) => (
                <tr key={`${item.memberId}-${item.email}-${index}`}>
                  <td style={tdStyle}>{item.memberTitle}</td>
                  <td style={tdStyle}>
                    <code>{item.email}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}