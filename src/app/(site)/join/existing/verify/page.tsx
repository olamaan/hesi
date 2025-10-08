// src/app/(site)/join/existing/verify/page.tsx
import { createClient } from '@sanity/client'
import { apiVersion } from '@/sanity/env'
import { jwtVerify } from 'jose'
import PriorityApplyForm from '@/components/PriorityApplyForm'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!
const secret    = new TextEncoder().encode(process.env.MAGIC_LINK_SECRET || '')

const client = createClient({ projectId, dataset, apiVersion, useCdn: true })

export default async function VerifyPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const token = (Array.isArray(searchParams?.token) ? searchParams?.token[0] : searchParams?.token) || ''
  if (!token) return <div className="alert alert--warn">Missing token.</div>

  try {
    const { payload } = await jwtVerify(token, secret)
    const postId = String(payload.postId || '')
    const email  = String(payload.email  || '')
    if (!postId || !email) throw new Error('Bad token')

    // Fetch areas & member title (for context)
    const [areas, post] = await Promise.all([
      client.fetch(`*[_type=="priorityArea"]|order(title asc){ _id, title }`),
      client.fetch(`*[_type=="post" && _id==$id][0]{ _id, title, "countryTitle": country->title }`, { id: postId }),
    ])

    if (!post) return <div className="alert alert--warn">Member not found.</div>

    return (
      <section>
        <h2>Apply for Priority Area membership</h2>
        <p className="muted">Signed in as <strong>{email}</strong> for <strong>{post.title}</strong>{post.countryTitle ? ` — ${post.countryTitle}` : ''}.</p>
        <PriorityApplyForm postId={postId} email={email} areas={areas} />
      </section>
    )
  } catch {
    return <div className="alert alert--warn">Your link is invalid or expired. Please request a new one.</div>
  }
}
