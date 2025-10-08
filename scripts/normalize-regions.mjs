#!/usr/bin/env node
// Usage:
//   Dry-run (no writes):
//     node scripts/normalize-regions.mjs --dry-run
//   Apply remap (patch countries):
//     node scripts/normalize-regions.mjs --apply
//   Apply + delete unused non-canonical regions:
//     node scripts/normalize-regions.mjs --apply --delete-extras

import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import { createClient } from '@sanity/client'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })
dotenv.config({})

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET
const apiVersion = (process.env.SANITY_API_VERSION || '2024-10-01').replace(/^v?/, 'v')
const token = (process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN || '').trim()

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const DELETE_EXTRAS = args.has('--delete-extras')

if (!projectId || !dataset) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET')
  process.exit(1)
}
if (!token) {
  console.error('Missing SANITY_WRITE_TOKEN (or SANITY_API_TOKEN).')
  process.exit(1)
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

const CANON = [
  { _id: 'region.africa',         title: 'Africa' },
  { _id: 'region.asia-pacific',   title: 'Asia-Pacific' },
  { _id: 'region.europe',         title: 'Europe' },
  { _id: 'region.lac',            title: 'Latin America and the Caribbean' },
  { _id: 'region.north-america',  title: 'North America' },
  { _id: 'region.western-asia',   title: 'Western Asia' },
]
const CANON_BY_TITLE = new Map(CANON.map(r => [r.title.toLowerCase(), r._id]))
const CANON_IDS = new Set(CANON.map(r => r._id))

// Normalize helpers
const norm = s => (s ?? '').toString().trim()
const key = s =>
  norm(s).toLowerCase()
    .replace(/\s*&\s*/g, ' and ')
    .replace(/[\u2010-\u2015]/g, '-')     // various dashes → hyphen
    .replace(/\s+/g, ' ')
const justLetters = s =>
  key(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'')

// Synonyms → canonical title

const SYNS = new Map([
  // Africa
  ['africa','Africa'], ['sub-saharan africa','Africa'], ['north africa','Africa'],

  // Asia-Pacific (collapse all Asia + Oceania subregions here)
  ['asia-pacific','Asia-Pacific'], ['asia pacific','Asia-Pacific'],
  ['asia and the pacific','Asia-Pacific'], ['asia & pacific','Asia-Pacific'],
  ['asia','Asia-Pacific'], ['east asia','Asia-Pacific'], ['eastern asia','Asia-Pacific'],
  ['south asia','Asia-Pacific'], ['southern asia','Asia-Pacific'],
  ['southeast asia','Asia-Pacific'], ['south-east asia','Asia-Pacific'], ['south eastern asia','Asia-Pacific'],
  ['south-eastern asia','Asia-Pacific'], ['central asia','Asia-Pacific'],
  ['oceania','Asia-Pacific'], ['australia and new zealand','Asia-Pacific'], ['australia & new zealand','Asia-Pacific'],
  ['melanesia','Asia-Pacific'], ['micronesia','Asia-Pacific'], ['polynesia','Asia-Pacific'],

  // Europe
  ['europe','Europe'], ['eastern europe','Europe'], ['western europe','Europe'],
  ['northern europe','Europe'], ['southern europe','Europe'],

  // Latin America and the Caribbean
  ['latin america and the caribbean','Latin America and the Caribbean'],
  ['latin america & the caribbean','Latin America and the Caribbean'],
  ['latin america and caribbean','Latin America and the Caribbean'],
  ['latin america','Latin America and the Caribbean'],
  ['south america','Latin America and the Caribbean'],
  ['central america','Latin America and the Caribbean'],
  ['caribbean','Latin America and the Caribbean'], ['lac','Latin America and the Caribbean'],

  // North America
  ['north america','North America'], ['northern america','North America'], ['na','North America'],

  // Western Asia (stays separate)
  ['western asia','Western Asia'], ['west asia','Western Asia'],
  ['middle east','Western Asia'], ['near east','Western Asia'], ['arab states','Western Asia'],
])




function toCanonId(title) {
  if (!title) return null
  const k = key(title)
  const direct = CANON_BY_TITLE.get(k)
  if (direct) return direct
  const viaSynTitle = SYNS.get(k)
  if (viaSynTitle) return CANON_BY_TITLE.get(viaSynTitle.toLowerCase()) || null
  // loose match (e.g., "Northern Europe" → Europe)
  const jl = justLetters(title)
  for (const [canonTitle, id] of CANON_BY_TITLE.entries()) {
    if (justLetters(canonTitle).includes(jl) || jl.includes(justLetters(canonTitle))) return id
  }
  return null
}

async function upsertCanonRegions() {
  const tx = client.transaction()
  for (const r of CANON) {
    tx.createOrReplace({ _id: r._id, _type: 'region', title: r.title })
  }
  await tx.commit()
}

async function main() {
  console.log(`[regions] Project ${projectId}/${dataset} — ${APPLY ? 'APPLY' : 'DRY RUN'}`)

  // Ensure canonical regions exist
  if (APPLY) {
    console.log('[regions] Upserting 6 canonical regions…')
    await upsertCanonRegions()
  } else {
    console.log('[regions] (dry-run) would upsert 6 canonical regions')
  }

  // Current snapshot
  const regions = await client.fetch(`*[_type=="region"]{ _id, title } | order(title asc)`)
  console.log(`[regions] existing region docs: ${regions.length}`)

  const countries = await client.fetch(`*[_type=="country"]{
    _id, title, "region": region->{_id, title}
  } | order(title asc)`)
  console.log(`[regions] countries: ${countries.length}`)

  // Build remap plan
  const plan = []
  let alreadyOk = 0, needsSet = 0, noRegion = 0, unknownRegionTitle = 0

  for (const c of countries) {
    const cur = c.region
    const targetId = toCanonId(cur?.title)
    if (!cur) { noRegion++; continue }
    if (!targetId) { unknownRegionTitle++; continue }
    if (cur._id === targetId) { alreadyOk++; continue }
    plan.push({ countryId: c._id, country: c.title, from: cur.title, toId: targetId })
    needsSet++
  }

  console.log(`[regions] summary:`)
  console.log(`  - already canonical: ${alreadyOk}`)
  console.log(`  - need remap:       ${needsSet}`)
  console.log(`  - missing region:   ${noRegion}`)
  console.log(`  - unknown titles:   ${unknownRegionTitle}`)

  // Show a preview of first few planned remaps
  console.log(`[regions] sample remaps (first 10):`)
  plan.slice(0, 10).forEach(p =>
    console.log(`    • ${p.country}: "${p.from}" → ${p.toId}`)
  )

  // Apply remaps
  if (APPLY && plan.length) {
    console.log(`[regions] applying ${plan.length} country patches…`)
    const BATCH = 200
    for (let i = 0; i < plan.length; i += BATCH) {
      const slice = plan.slice(i, i + BATCH)
      const tx = client.transaction()
      for (const p of slice) {
        tx.patch(p.countryId, { set: { region: { _type: 'reference', _ref: p.toId } } })
      }
      await tx.commit()
      console.log(`  - committed ${Math.min(i + BATCH, plan.length)}/${plan.length}`)
    }
  } else if (!APPLY) {
    console.log('[regions] (dry-run) no patches sent.')
  }

  // Optionally delete extra regions
  if (APPLY && DELETE_EXTRAS) {
    const unused = await client.fetch(
      `*[_type=="region" && !(_id in $canon) && count(*[_type=="country" && references(^._id)]) == 0]{ _id, title }`,
      { canon: Array.from(CANON_IDS) }
    )
    console.log(`[regions] removable non-canonical regions: ${unused.length}`)
    if (unused.length) {
      const tx = client.transaction()
      unused.forEach(r => tx.delete(r._id))
      await tx.commit()
      console.log(`[regions] deleted ${unused.length} region doc(s).`)
    }
  } else if (!APPLY && DELETE_EXTRAS) {
    console.log('[regions] (dry-run) would delete unused non-canonical regions.')
  }

  console.log('[regions] done.')
}

main().catch(e => {
  console.error('[regions] fatal:', e)
  process.exit(1)
})
