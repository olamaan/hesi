// src/app/(site)/join/page.tsx
import { client } from '@/sanity/lib/client'
import SubmitForm from '@/components/SubmitForm'

type Area = { _id: string; title: string; slug?: { current?: string } | string }
type Country = { _id: string; title: string }

export const revalidate = 0

export default async function JoinPage() {
  const [areas, countries] = await Promise.all([
    client.fetch<Area[]>(
      `*[_type=="priorityArea"]|order(title asc){ _id, title, "slug": slug.current }`
    ),
    client.fetch<Country[]>(
      `*[_type=="country"]|order(title asc){ _id, title }`
    ),
  ])

  return (
    <div>
      <h1 >Join HESI</h1>
 

      <SubmitForm areas={areas} countries={countries} />
    </div>
  )
}
