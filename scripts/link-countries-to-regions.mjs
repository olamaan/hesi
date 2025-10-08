import 'dotenv/config'
import dotenv from 'dotenv'

// load .env.local first, then fall back to .env
dotenv.config({ path: '.env.local' })
dotenv.config()

import { createClient } from '@sanity/client'
import countries from 'world-countries'

const projectId = process.env.SANITY_PROJECT_ID
const dataset = process.env.SANITY_DATASET
const token = process.env.SANITY_API_TOKEN
const apiVersion = process.env.SANITY_API_VERSION || '2024-10-01'

if (!projectId || !dataset || !token) {
  console.error('Missing SANITY_PROJECT_ID / SANITY_DATASET / SANITY_API_TOKEN')
  process.exit(1)
}

const client = createClient({ projectId, dataset, token, apiVersion, useCdn: false })

// Helper: get or create a Region doc by title
async function ensureRegionByTitle(title) {
  const existing = await client.fetch(`*[_type=="region" && title==$t][0]{_id}`, { t: title })
  if (existing?._id) return existing._id
  const res = await client.create({ _type: 'region', title })
  return res._id
}

// Build a map: country title -> subregion (fallback to region)
const subregionByTitle = new Map()
for (const c of countries) {
  const title = c.name.common
  const sub = c.subregion || c.region || 'Other'
  subregionByTitle.set(title, sub)
}

async function run() {
  // 1) fetch all countries in Sanity
  const all = await client.fetch(`*[_type=="country"]{_id, title, region}`)
  console.log(`Found ${all.length} country docs`)

  // 2) ensure regions exist + compute patches
  const patches = []
  for (const doc of all) {
    // keep existing region if already set
    if (doc?.region?._ref) continue

    const sub = subregionByTitle.get(doc.title)
    if (!sub) {
      console.warn(`No subregion for "${doc.title}" — skipping`)
      continue
    }
    const regionId = await ensureRegionByTitle(sub)

    patches.push({
      id: doc._id,
      patch: { set: { region: { _type: 'reference', _ref: regionId } } },
    })
  }

  if (!patches.length) {
    console.log('No patches needed.')
    return
  }

  // 3) apply in batches
  console.log(`Patching ${patches.length} countries...`)
  const CHUNK = 100
  for (let i = 0; i < patches.length; i += CHUNK) {
    const tx = client.transaction()
    for (const { id, patch } of patches.slice(i, i + CHUNK)) {
      tx.patch(id, patch)
    }
    await tx.commit()
    console.log(`Committed ${Math.min(i + CHUNK, patches.length)} / ${patches.length}`)
  }
  console.log('Done.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})