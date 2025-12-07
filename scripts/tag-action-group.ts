// scripts/tag-action-group.ts
import 'dotenv/config'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@sanity/client'

// Load .env.local first, then .env
dotenv.config({ path: '.env.local' })
dotenv.config()

// ---------- CLI ARGS ----------
const argv = process.argv.slice(2)
function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = argv.find(a => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

const ARG_GROUP = readArg('group') // e.g. --group="Education for Green Jobs"
const ARG_FILE = readArg('file')   // e.g. --file=scripts/green-jobs.txt

// ---------- ENV / CONFIG ----------
const projectId =
  process.env.SANITY_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset =
  process.env.SANITY_DATASET ||
  process.env.NEXT_PUBLIC_SANITY_DATASET
const token =
  process.env.SANITY_API_TOKEN ||
  process.env.SANITY_TOKEN
const apiVersion =
  process.env.SANITY_API_VERSION ||
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ||
  '2025-01-01'

// Dry-run defaults true; set DRY_RUN=false to write
const DRY_RUN = (process.env.DRY_RUN ?? 'true') !== 'false'
// Auto-create the actionGroup doc if missing
const CREATE_GROUP = (process.env.CREATE_GROUP ?? 'false') === 'true'

// You can still hardcode a fallback group here if you want:
const GROUP_TITLE = ARG_GROUP || process.env.GROUP_TITLE || 'Education for Green Jobs'

// Inline fallback list if --file is not used (edit or leave empty)
const INLINE_INPUT_NAMES: string[] = [
  // 'Example Org 1',
  // 'Example Org 2',
]

if (!projectId || !dataset || !token) {
  console.error('Missing SANITY_PROJECT_ID / SANITY_DATASET / SANITY_API_TOKEN')
  process.exit(1)
}

// ---------- SANITY CLIENT ----------
const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

type Ref = { _type: 'reference'; _ref: string; _key?: string }
type PostDoc = {
  _id: string
  _type: 'post'
  title?: string
  actionGroups?: Ref[]
}

// ---------- INPUT LIST LOADING ----------
function loadNames(): string[] {
  if (ARG_FILE) {
    const p = path.resolve(ARG_FILE)
    if (!fs.existsSync(p)) {
      console.error(`Input file not found: ${p}`)
      process.exit(1)
    }
    const raw = fs.readFileSync(p, 'utf8')
    const lines = raw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
    return Array.from(new Set(lines))
  }
  return Array.from(new Set(INLINE_INPUT_NAMES.map(s => s.trim()).filter(Boolean)))
}

async function getActionGroupIdByTitle(title: string): Promise<string | null> {
  const q = `*[_type=="actionGroup" && lower(title)==$t][0]{_id}`
  const doc = await client.fetch<{ _id: string } | null>(q, { t: title.toLowerCase() })
  return doc?._id ?? null
}

async function createActionGroup(title: string): Promise<string> {
  const res = await client.create({
    _type: 'actionGroup',
    title,
  })
  return res._id as string
}

async function findPost(name: string): Promise<{ doc: PostDoc | null; strategy: 'exact' | 'fuzzy' | '' }> {
  // Exact (case-insensitive)
  const exact = await client.fetch<PostDoc | null>(
    `*[_type=="post" && lower(title)==$t][0]{_id,_type,title,actionGroups}`,
    { t: name.toLowerCase() }
  )
  if (exact) return { doc: exact, strategy: 'exact' }

  // Fuzzy prefix match
  const cleaned = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '')
  const fuzzy = await client.fetch<PostDoc | null>(
    `*[_type=="post" && title match $q][0]{_id,_type,title,actionGroups}`,
    { q: `${cleaned}*` }
  )
  if (fuzzy) return { doc: fuzzy, strategy: 'fuzzy' }

  return { doc: null, strategy: '' }
}

async function run(): Promise<void> {
  if (!GROUP_TITLE) {
    console.error('Please provide an action group title via --group="..." or GROUP_TITLE env var.')
    process.exit(1)
  }

  let groupId = await getActionGroupIdByTitle(GROUP_TITLE)
  if (!groupId) {
    if (CREATE_GROUP) {
      if (DRY_RUN) {
        console.log(`DRY RUN: would create actionGroup "${GROUP_TITLE}"`)
        // Generate a placeholder id so the rest of the script can simulate
        groupId = 'drafts.' + crypto.randomUUID()
      } else {
        console.log(`Creating actionGroup "${GROUP_TITLE}"…`)
        groupId = await createActionGroup(GROUP_TITLE)
      }
    } else {
      console.error(`❌ actionGroup "${GROUP_TITLE}" not found. (Set CREATE_GROUP=true to auto-create)`)
      process.exit(1)
    }
  }

  const inputNames = loadNames()
  if (!inputNames.length) {
    console.error('No input names provided. Use --file=names.txt or fill INLINE_INPUT_NAMES.')
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

  for (const name of inputNames) {
    try {
      const { doc, strategy } = await findPost(name)

      if (!doc?._id) {
        rows.push({ Name: name, FoundTitle: '', Strategy: '', AlreadyLinked: false, Mutated: false, Note: 'NOT FOUND' })
        continue
      }

      const already = Array.isArray(doc.actionGroups)
        ? doc.actionGroups.some(r => r && r._ref === groupId)
        : false

      if (already) {
        rows.push({ Name: name, FoundTitle: doc.title ?? '', Strategy: strategy, AlreadyLinked: true, Mutated: false, Note: 'Already linked' })
        continue
      }

      const refWithKey: Ref = { _type: 'reference', _ref: groupId, _key: crypto.randomUUID() }
      const patch = client.patch(doc._id)
        .setIfMissing({ actionGroups: [] })
        .insert('after', 'actionGroups[-1]', [refWithKey])

      if (DRY_RUN) {
        rows.push({ Name: name, FoundTitle: doc.title ?? '', Strategy: strategy, AlreadyLinked: false, Mutated: false, Note: 'DRY RUN: would add reference' })
      } else {
        await patch.commit()
        rows.push({ Name: name, FoundTitle: doc.title ?? '', Strategy: strategy, AlreadyLinked: false, Mutated: true, Note: 'Updated' })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      rows.push({ Name: name, FoundTitle: '', Strategy: '', AlreadyLinked: false, Mutated: false, Note: `ERROR: ${msg}` })
    }
  }

  console.table(rows)
  const updated = rows.filter(r => r.Note === 'Updated').length
  const dry = rows.filter(r => r.Note.startsWith('DRY RUN')).length
  const already = rows.filter(r => r.Note === 'Already linked').length
  const missing = rows.filter(r => r.Note === 'NOT FOUND').length
  console.log(`\nGroup: "${GROUP_TITLE}"  |  Summary: Updated=${updated} DryRun=${dry} Already=${already} NotFound=${missing}`)
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
