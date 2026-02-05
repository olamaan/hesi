import Link from 'next/link'
import { notFound } from 'next/navigation'
import { publicClient as client } from '@/sanity/lib/client'

export default async function MemberPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id)

  const member = await client.fetch(
    `*[_type == "post" && _id == $id][0]{
      _id,
      title,
      description,
      website,
      datejoined,
      "countryTitle": country->title,
      "regionTitle": country->region->title
    }`,
    { id },
    { next: { revalidate: 60 } }
  )

  if (!member) return notFound()

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/" className="reset-link">← Back to list</Link>
      </p>

      <h1>{member.title}</h1>

      <p className="muted">
        {member.countryTitle ?? '—'}
        {member.regionTitle ? ` • ${member.regionTitle}` : ''}
      </p>

      {member.website ? (
        <p>
          <a className="webLink" href={member.website} target="_blank" rel="noopener noreferrer">
            {member.website}
          </a>
        </p>
      ) : null}

      {member.description ? (
        <>
          <h3>Description</h3>
          <p>{member.description}</p>
        </>
      ) : null}
    </div>
  )
}
