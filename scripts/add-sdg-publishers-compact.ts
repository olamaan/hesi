// scripts/add-sdg-publishers-compact.ts

import 'dotenv/config'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import { createClient } from '@sanity/client'

// Load .env.local first, then .env (same pattern as your working scripts)
dotenv.config({ path: '.env.local' })
dotenv.config()

// Accept both server-side and NEXT_PUBLIC env names
const projectId =
  process.env.SANITY_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset =
  process.env.SANITY_DATASET ||
  process.env.NEXT_PUBLIC_SANITY_DATASET
const token =
  process.env.SANITY_API_TOKEN || // reuse your existing write token
  process.env.SANITY_TOKEN
const apiVersion =
  process.env.SANITY_API_VERSION ||
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ||
  '2025-01-01'

// Dry-run defaults to true unless explicitly set to "false"
const DRY_RUN = (process.env.DRY_RUN ?? 'true') !== 'false'

if (!projectId || !dataset || !token) {
  console.error('Missing SANITY_PROJECT_ID / SANITY_DATASET / SANITY_API_TOKEN (or NEXT_PUBLIC_*)')
  process.exit(1)
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
})

type Ref = { _type: 'reference'; _ref: string; _key?: string }
type PostDoc = {
  _id: string
  _type: 'post'
  title?: string
  actionGroups?: Ref[]
}

const GROUP_TITLE = 'SDG Publishers Compact'

// Your input list:
const INPUT_NAMES = [
  'International Consortium for Accreditation and Research Management',
  'Association for the Advancement of Sustainability in Higher Education',
  'Western Governors University',
  'International Institute for Sustainable Laboratories',
  'The Hong Kong Polytechnic University',
  'Singapore Institute of Technology',
  'University of Hong Kong',
  'SDG Publishers Compact Fellows',
  'Higher Education Associations Sustainability Consortium',
  'Foundation for Environmental Education (FEE)',
  'Environmental Association for Universities and Colleges (EAUC)',
  'Association of Commonwealth Universities',
  'The Lemelson Foundation',
  'INQAAHE',
  'Boston University',
  'Global Academy of Finance and Management - International Board of Standards',
  'National Disaster Preparedness Training Center',
  'FEE EcoCampus',
  'Dissertations for Good',
  'McGill University',
  'Portland Community College',
  'State University of New York (SUNY)',
  'Times Higher Education',
  'University of Connecticut',
  'International Association of Universities',
  'Higher Education Association Sustainability Consortium',
  'Alliance for Sustianability Leadership in Education (EAUC)',
  'Association for the Advancement of Sustainability in Higher Education (AASHE)',
  'Sulitest',
  'Arizona State University',
  "Women's Health and Education Center (WHEC)",
  'Griffith University',
  'American Association for Higher Education and Accreditation AAHEA',
]

// Normalize/dedupe
const NAMES = Array.from(new Set(INPUT_NAMES.map((s) => s.trim()).filter(Boolean)))

async function getActionGroupIdByTitle(title: string): Promise<string | null> {
  const q = `*[_type=="actionGroup" && lower(title)==$t][0]{_id}`
  const doc = await client.fetch<{ _id: string } | null>(q, { t: title.toLowerCase() })
  return doc?._id ?? null
}

async function findPost(name: string): Promise<{ doc: PostDoc | null; strategy: 'exact' | 'fuzzy' | '' }> {
  // Exact (case-insensitive)
  const exact = await client.fetch<PostDoc | null>(
    `*[_type=="post" && lower(title)==$t][0]{_id,_type,title,actionGroups}`,
    { t: name.toLowerCase() }
  )
  if (exact) return { doc: exact, strategy: 'exact' }

  // Fuzzy (prefix) to catch small variations
  const cleaned = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '')
  const fuzzy = await client.fetch<PostDoc | null>(
    `*[_type=="post" && title match $q][0]{_id,_type,title,actionGroups}`,
    { q: `${cleaned}*` }
  )
  if (fuzzy) return { doc: fuzzy, strategy: 'fuzzy' }

  return { doc: null, strategy: '' }
}

async function run(): Promise<void> {
  const groupId = await getActionGroupIdByTitle(GROUP_TITLE)
  if (!groupId) {
    console.error(`❌ actionGroup "${GROUP_TITLE}" not found. Create it in Studio first.`)
    process.exit(1)
  }

  type Row = {
    Name: string
    FoundTitle: string
    Strategy: 'exact' | 'fuzzy' | ''
    AlreadyLinked: boolean
    Mutated: boolean
    Note: string
  }

  const rows: Row[] = []

  for (const name of NAMES) {
    try {
      const { doc, strategy } = await findPost(name)

      if (!doc?._id) {
        rows.push({ Name: name, FoundTitle: '', Strategy: '', AlreadyLinked: false, Mutated: false, Note: 'NOT FOUND' })
        continue
      }

      const already = Array.isArray(doc.actionGroups)
        ? doc.actionGroups.some((r) => r && r._ref === groupId)
        : false

      if (already) {
        rows.push({
          Name: name,
          FoundTitle: doc.title ?? '',
          Strategy: strategy,
          AlreadyLinked: true,
          Mutated: false,
          Note: 'Already linked',
        })
        continue
      }

      const refWithKey: Ref = {
        _type: 'reference',
        _ref: groupId,
        _key: crypto.randomUUID(), // ✅ ensure a unique array item key
      }

      const patch = client
        .patch(doc._id)
        .setIfMissing({ actionGroups: [] })
        .insert('after', 'actionGroups[-1]', [refWithKey])

      if (DRY_RUN) {
        rows.push({
          Name: name,
          FoundTitle: doc.title ?? '',
          Strategy: strategy,
          AlreadyLinked: false,
          Mutated: false,
          Note: 'DRY RUN: would add reference',
        })
      } else {
        await patch.commit()
        rows.push({
          Name: name,
          FoundTitle: doc.title ?? '',
          Strategy: strategy,
          AlreadyLinked: false,
          Mutated: true,
          Note: 'Updated',
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      rows.push({ Name: name, FoundTitle: '', Strategy: '', AlreadyLinked: false, Mutated: false, Note: `ERROR: ${message}` })
    }
  }

  console.table(rows)
  const updated = rows.filter((r) => r.Note === 'Updated').length
  const dry = rows.filter((r) => r.Note.startsWith('DRY RUN')).length
  const already = rows.filter((r) => r.Note === 'Already linked').length
  const missing = rows.filter((r) => r.Note === 'NOT FOUND').length
  console.log(`\nSummary: Updated=${updated} DryRun=${dry} Already=${already} NotFound=${missing}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
