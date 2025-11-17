import 'dotenv/config'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import { createClient } from '@sanity/client'
import crypto from 'node:crypto'

const projectId =
  process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset =
  process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET
const token = process.env.SANITY_API_TOKEN || process.env.SANITY_TOKEN
const apiVersion =
  process.env.SANITY_API_VERSION || process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-01-01'

if (!projectId || !dataset || !token) {
  console.error('Missing SANITY_PROJECT_ID / SANITY_DATASET / SANITY_API_TOKEN')
  process.exit(1)
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

async function run() {
  const docs = await client.fetch(
    `*[_type=="post" && defined(actionGroups) && count(actionGroups[!defined(_key)]) > 0]{
      _id,
      actionGroups
    }`
  )

  if (!docs.length) {
    console.log('No posts need fixing. ✅')
    return
  }

  console.log(`Fixing ${docs.length} document(s)…`)
  for (const d of docs) {
    const fixed = (d.actionGroups || []).map((item) =>
      item && item._type === 'reference'
        ? { _type: 'reference', _ref: item._ref, _key: item._key || crypto.randomUUID() }
        : item
    )

    await client.patch(d._id).set({ actionGroups: fixed }).commit()
    console.log(`✔ Patched ${d._id}`)
  }

  console.log('Done.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
