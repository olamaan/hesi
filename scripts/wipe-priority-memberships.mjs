#!/usr/bin/env node
// scripts/wipe-memberships-and-posts.mjs
// Cleans inbound references to priorityMembership and/or post docs, then deletes them.

import dotenv from 'dotenv'
import process from 'node:process'
import readline from 'readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { createClient } from '@sanity/client'

dotenv.config({ path: '.env.local', override: true })
dotenv.config()

const projectId  = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset    = process.env.NEXT_PUBLIC_SANITY_DATASET
const token      = (process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN || '').trim()
const apiRaw     = process.env.SANITY_API_VERSION || '2024-10-01'
const apiVersion = apiRaw.startsWith('v') ? apiRaw : `v${apiRaw}`

if (!projectId || !dataset) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET')
  process.exit(1)
}
if (!token) {
  console.error('Missing SANITY_WRITE_TOKEN (or SANITY_API_TOKEN) with delete rights')
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry-run')
const YES = args.has('--yes')
const WIPE_POSTS = args.has('--wipe-posts') || args.has('--posts') || args.has('--all')
const WIPE_MEMBERSHIPS = !args.has('--skip-memberships') // default true
const BATCH = Number(process.env.WIPE_BATCH || 200)

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

/* ---------------- helpers ---------------- */
function isRef(v){ return v && typeof v==='object' && v._type==='reference' && typeof v._ref==='string' }
function hasAnyRefTo(arr, idset){ return Array.isArray(arr) && arr.some(v => isRef(v) && idset.has(v._ref)) }
function filterRefs(arr, idset){ return Array.isArray(arr) ? arr.filter(v => !(isRef(v) && idset.has(v._ref))) : arr }

async function findReferencingDocs(ids){
  if (!ids.length) return []
  return client.fetch('*[references($ids)]{_id,_type}', { ids })
}
async function loadDocs(ids){
  if (!ids.length) return []
  return client.fetch('*[_id in $ids]', { ids })
}

async function cleanRefsInDocs(docs, idset, label){
  let patched = 0
  for (let i=0; i<docs.length; i+=50){
    const slice = docs.slice(i, i+50)
    const tx = client.transaction()
    for (const doc of slice){
      const sets = {}
      const unsets = []
      for (const [k, v] of Object.entries(doc)){
        if (k.startsWith('_')) continue // skip system fields
        // remove scalar reference to any target id
        if (isRef(v) && idset.has(v._ref)){
          unsets.push(k)
        }
        // clean arrays of references
        else if (Array.isArray(v) && hasAnyRefTo(v, idset)){
          const filtered = filterRefs(v, idset)
          if (filtered.length === 0) unsets.push(k)
          else sets[k] = filtered
        }
      }
      if (Object.keys(sets).length || unsets.length){
        const p = client.patch(doc._id)
        if (Object.keys(sets).length) p.set(sets)
        if (unsets.length) p.unset(unsets)
        tx.patch(p)
        patched++
      }
    }
    if (!DRY && patched) await tx.commit()
  }
  if (patched) console.log(`[clean] Patched ${patched} document(s) to remove ${label} references.`)
  return patched
}

async function deleteByIds(ids, label){
  let deleted = 0
  for (let i=0; i<ids.length; i+=BATCH){
    const batch = ids.slice(i, i+BATCH)
    const tx = client.transaction()
    for (const id of batch) tx.delete(id)
    if (!DRY) await tx.commit()
    deleted += batch.length
    process.stdout.write(`[delete ${label}] ${deleted}/${ids.length}\r`)
  }
  process.stdout.write('\n')
  return deleted
}

/* ---------------- wipe memberships ---------------- */
async function wipeMemberships(){
  const pmIds = await client.fetch('*[_type=="priorityMembership"]._id')
  console.log(`[scan] Found ${pmIds.length} priorityMembership doc(s).`)
  if (pmIds.length === 0) return 0

  const sample = await client.fetch(
    '*[_type=="priorityMembership"][0...5]{_id,status,"postTitle":post->title,"areaTitle":priorityArea->title}'
  )
  if (sample.length){
    console.log('[scan] Sample priorityMemberships:')
    for (const s of sample){
      console.log(`  - ${s._id} — ${s.postTitle||'(post)'} × ${s.areaTitle||'(area)'} — ${s.status||''}`)
    }
    if (pmIds.length > sample.length) console.log(`  …and ${pmIds.length - sample.length} more`)
  }

  const referencers = await findReferencingDocs(pmIds)
  console.log(`[scan] ${referencers.length} doc(s) reference memberships.`)
  const refDocs = await loadDocs(referencers.map(d => d._id))
  await cleanRefsInDocs(refDocs, new Set(pmIds), 'membership')

  console.log('[delete] Deleting priorityMembership docs…')
  const n = await deleteByIds(pmIds, 'membership')
  console.log(`[done] Deleted ${n} priorityMembership doc(s).`)
  return n
}

/* ---------------- wipe posts ---------------- */
async function wipePosts(){
  const postIds = await client.fetch('*[_type=="post"]._id')
  console.log(`[scan] Found ${postIds.length} post doc(s).`)
  if (postIds.length === 0) return 0

  const sample = await client.fetch(
    '*[_type=="post"][0...5]{_id,title,"countryTitle":country->title,status}'
  )
  if (sample.length){
    console.log('[scan] Sample posts:')
    for (const s of sample){
      console.log(`  - ${s._id} — ${s.title||'(untitled)'} — ${s.countryTitle||'(no country)'} — ${s.status||''}`)
    }
    if (postIds.length > sample.length) console.log(`  …and ${postIds.length - sample.length} more`)
  }

  const referencers = await findReferencingDocs(postIds)
  console.log(`[scan] ${referencers.length} doc(s) reference posts.`)
  const refDocs = await loadDocs(referencers.map(d => d._id))
  await cleanRefsInDocs(refDocs, new Set(postIds), 'post')

  console.log('[delete] Deleting post docs…')
  const n = await deleteByIds(postIds, 'post')
  console.log(`[done] Deleted ${n} post doc(s).`)
  return n
}

/* ---------------- main ---------------- */
;(async()=>{
  console.log(`[env] projectId=${projectId} dataset=${dataset} api=${apiVersion} dryRun=${DRY} yes=${YES}`)
  if (DRY){
    if (WIPE_MEMBERSHIPS) await wipeMemberships()
    if (WIPE_POSTS)       await wipePosts()
    console.log('[dry-run] No changes were made.')
    process.exit(0)
  }

  // Confirm destructive action
  const rl = YES ? null : readline.createInterface({ input, output })
  if (!YES){
    const what = [
      WIPE_MEMBERSHIPS ? 'priorityMemberships' : null,
      WIPE_POSTS ? 'posts' : null
    ].filter(Boolean).join(' + ')
    const ans = (await rl.question(`Type CONFIRM to wipe ${what}: `)).trim()
    rl.close()
    if (ans !== 'CONFIRM'){
      console.log('Aborted.')
      process.exit(0)
    }
  }

  if (WIPE_MEMBERSHIPS) await wipeMemberships()
  if (WIPE_POSTS)       await wipePosts()
  console.log('[all done]')
})().catch((e)=>{
  console.error('\n[error]', e?.message || e)
  process.exit(1)
})
