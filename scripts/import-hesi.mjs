#!/usr/bin/env node
// Usage examples:
//   Dry run first 50 rows (CSV has headers):
//     node scripts/import-hesi.mjs --file data/hesi.csv --dry-run --limit 50
//
//   Real import (wipe posts first) and treat all as "published":
//     node scripts/import-hesi.mjs --file data/hesi.csv --wipe-posts
//
//   Import as submitted:
//     node scripts/import-hesi.mjs --file data/hesi.csv --status submitted
//
//   CSV has headers with different captions/order:
//     node scripts/import-hesi.mjs --file data/new.csv \
//       --status submitted \
//       --map 'title=Institution,country=Nation,dateJoined=Joined,website=URL,email=Contacts,focalpoint=Focal'
//
//   CSV has NO headers (fixed order):
//     node scripts/import-hesi.mjs --file data/noheaders.csv --no-headers
//
// ENV required (in .env.local or env):
//   NEXT_PUBLIC_SANITY_PROJECT_ID=xxxx
//   NEXT_PUBLIC_SANITY_DATASET=production
//   SANITY_WRITE_TOKEN=sk...
//   (or) SANITY_API_TOKEN=sk...

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import { createClient } from '@sanity/client'
import PapaModule from 'papaparse'
import { parse as parseCsv } from 'csv-parse/sync'

// ---- Load env --------------------------------------------------------------
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true, quiet: true })
dotenv.config({ quiet: true })

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET
const apiVersionRaw = process.env.SANITY_API_VERSION || '2024-10-01'
const apiVersion = apiVersionRaw.startsWith('v') ? apiVersionRaw : `v${apiVersionRaw}`

const TOK_WRITE = (process.env.SANITY_WRITE_TOKEN || '').trim()
const TOK_API   = (process.env.SANITY_API_TOKEN   || '').trim()

// ---- Args ------------------------------------------------------------------
function getArgs(argv){
  const out = {
    file: null,
    dryRun: false,
    status: 'published',        // 'published' | 'submitted'
    delimiter: ',',
    limit: 0,
    wipePosts: false,
    noHeaders: false,
    map: null                   // e.g. 'title=Institution,country=Nation,...'
  }
  const a = argv.slice(2)
  for (let i=0;i<a.length;i++){
    const k=a[i]
    if (k==='--file') out.file=a[++i]
    else if (k==='--dry-run') out.dryRun=true
    else if (k==='--status') out.status=String(a[++i]||'').toLowerCase()
    else if (k==='--delimiter') out.delimiter=a[++i]
    else if (k==='--limit') out.limit=Number(a[++i]||0)
    else if (k==='--wipe-posts'||k==='--wipe') out.wipePosts=true
    else if (k==='--no-headers') out.noHeaders=true
    else if (k==='--map') out.map=a[++i]
  }
  return out
}
const args = getArgs(process.argv)

// Delete ONLY posts whose status is "submitted" (case-insensitive)
async function wipeSubmittedPosts(client, dryRun){
  const total = await client.fetch('count(*[_type=="post" && lower(status)=="submitted"])')
  if (dryRun){
    console.log(`[wipe] DRY RUN — would delete ${total} post(s) with status "submitted".`)
    return
  }
  if (!total){
    console.log('[wipe] No posts with status "submitted" to delete.')
    return
  }
  console.log(`[wipe] Deleting ${total} post(s) with status "submitted"…`)
  const BATCH = 200
  let deleted = 0
  while (true){
    const ids = await client.fetch('*[_type=="post" && lower(status)=="submitted"][0...$b]{_id}', { b: BATCH })
    if (!ids.length) break
    const tx = client.transaction()
    for (const { _id } of ids) tx.delete(_id)
    await tx.commit()
    deleted += ids.length
    process.stdout.write(`[wipe] ${deleted}/${total}…\r`)
  }
  process.stdout.write('\n[wipe] Done.\n')
}



// ---- Guards ----------------------------------------------------------------
if (!args.file){ console.error('Error: --file <path/to.csv> is required'); process.exit(1) }
if (!projectId || !dataset){ console.error('Error: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET'); process.exit(1) }

// ---- Helpers ---------------------------------------------------------------
const Papa = (() => {
  if (PapaModule && typeof PapaModule.parse === 'function') return PapaModule
  if (PapaModule && typeof PapaModule === 'function') return { parse: PapaModule }
  if (PapaModule?.default && typeof PapaModule.default.parse === 'function') return PapaModule.default
  throw new Error('papaparse import failed')
})()

function mergeDescriptions(d1, d2){
  const a = norm(d1), b = norm(d2)
  if (a && b) {
    // avoid duplicating when they’re the same
    if (a.toLowerCase() === b.toLowerCase()) return a
    return `${a}\n\n${b}`
  }
  return a || b || ''
}


const norm = (s)=> (s??'').toString().trim()
const normKey = (s)=> norm(s).toLowerCase()
const stripDiacritics = (s)=> s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
const cleanKey = (s)=> stripDiacritics(String(s)).toLowerCase().replace(/\(.*?\)/g,'').replace(/&/g,'and').replace(/[^a-z0-9]/g,'')
const fixUrl = (u)=>{ const s=norm(u); if(!s) return ''; if(/^https?:\/\//i.test(s)) return s; return `https://${s}` }
function splitEmails(v){
  if(!v) return []
  const raw = Array.isArray(v)? v.join(','): String(v)
  return raw
    .split(/[,\s;]+/)
    .map(e=>e.trim())
    .filter(e=>e && e.includes('@'))
    .filter((e,i,a)=>a.indexOf(e)===i)
}
function toISODate(input){
  if(!input) return null
  const s=String(input).trim()
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if(m){ let a=Number(m[1]), b=Number(m[2]), y=Number(m[3]); if(y<100) y+=2000; if(a>12) [a,b]=[b,a]; const pad=n=>String(n).padStart(2,'0'); return `${String(y).padStart(4,'0')}-${pad(a)}-${pad(b)}` }
  const dt=new Date(s); if(!isNaN(dt.getTime())){ const yyyy=dt.getFullYear(), mm=String(dt.getMonth()+1).padStart(2,'0'), dd=String(dt.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}` }
  return null
}

// Header mapping utilities
const normHeader = (s)=> String(s||'').trim().toLowerCase().replace(/\s+/g,' ')
function parseHeaderMap(str){
  if (!str) return {}
  const out = {}
  for (const part of String(str).split(',')) {
    const [k, ...rest] = part.split('=')
    if (!k || !rest.length) continue
    out[normHeader(k)] = normHeader(rest.join('='))
  }
  return out
}
const HEADER_MAP = parseHeaderMap(args.map || '')

// merge-aware header resolver: supports 'a|b' to combine two headers
const pickMerged = (row, spec) => {
  const keys = String(spec).split('|').map(s => s.trim()).filter(Boolean)
  const vals = []
  for (const key of keys) {
    for (const k of Object.keys(row)) {
      if (k.trim().toLowerCase() === key.toLowerCase() && row[k] != null && row[k] !== '') {
        vals.push(String(row[k]).trim())
        break
      }
    }
  }
  const merged = vals.filter(Boolean).join('\n').trim()
  return merged || undefined
}


// No-headers row mapper (fixed order)

// no-headers row mapper (YOUR batch order)
// [0] title, [1] website, [2] focal point, [3] job title (ignore),
// [4] email, [5] country, [6] org-type (ignore), [7] desacription,
// [8] skip, [9] description, [rest] skip

// no-headers row mapper for your new file layout
function rowFromArray(arr){
  const a = [...arr]
  // pad to at least 10 columns to avoid undefined reads
  while (a.length < 10) a.push('')
  return {
    title:        a[0],
    website:      a[1],
    focalpoint:   a[2],
    // a[3] = job title (ignored)
    email:        a[4],
    country:      a[5],
    // a[6] = org-type (ignored)
    description:  a[7],
    // a[8] = skip (ignored)
    description2: a[9],
  }
}






function rowFromArray2(arr){
  const a=[...arr]; while(a.length<8) a.push('')
  // expected default order when --no-headers:
  // [title, typeOfOrg, country, dateJoined, region, website, email, focalpoint]
  return {
    title:a[0], typeOfOrg:a[1], country:a[2], dateJoined:a[3],
    region:a[4], website:a[5], email:a[6], focalpoint:a[7]
  }
}

// Headers mapper with mapping + synonyms
function rowFromObject(row){
  const keys = Object.keys(row)
  const getByHeader = (wanted) => {
    const want = normHeader(wanted)
    for (const k of keys) if (normHeader(k) === want) return row[k]
    return undefined
  }
  const pick = (aliases, targetKey) => {
    if (HEADER_MAP[targetKey]) {
      const v = getByHeader(HEADER_MAP[targetKey])
      if (v != null && v !== '') return v
    }
    for (const a of aliases) {
      const v = getByHeader(a)
      if (v != null && v !== '') return v
    }
    return undefined
  }

  return {
  title: pickMerged(row, 'title|name|institution|organization|organisation|org|org name|entry title'),
  typeOfOrg: pickMerged(row, 'type of org|type|org type|organization type|organisation type'),
  country: pickMerged(row, 'country|country name|nation'),
  dateJoined: pickMerged(row, 'date joined|joined|join date|date|date_joined|dateJoined'),
  region: pickMerged(row, 'region|subregion|area'),
  website: pickMerged(row, 'website|url|link'),
  email: pickMerged(row, 'email|emails|e-mail|contact email|contacts'),
  focalpoint: pickMerged(row, 'focalpoint|focal point|contact name|main contact|focal'),
  description: pickMerged(row, 'desacription|description'),   // <-- merge both
}

}

// Country synonyms → canonical UN titles
const COUNTRY_SYNONYMS = new Map([
  ['usa','united states of america'], ['united states','united states of america'],
  ['uk','united kingdom of great britain and northern ireland'], ['united kingdom','united kingdom of great britain and northern ireland'],
  ['russia','russian federation'], ['south korea','republic of korea'], ['north korea',"democratic people's republic of korea"],
  ['iran','iran (islamic republic of)'], ['moldova','republic of moldova'], ['tanzania','united republic of tanzania'],
  ['laos',"lao people's democratic republic"], ['bolivia','bolivia (plurinational state of)'], ['venezuela','venezuela (bolivarian republic of)'],
  ['syria','syrian arab republic'], ['cape verde','cabo verde'], ['swaziland','eswatini'], ['czech republic','czechia'],
  ['burma','myanmar'], ['palestine','state of palestine'], ['ivory coast',"côte d'ivoire"], ['macedonia','north macedonia'],
  ['micronesia','micronesia (federated states of)'], ['brunei','brunei darussalam'],
  ['hong kong','china, hong kong sar'], ['macau','china, macao sar'],
  ['car','central african republic'], ['drc','democratic republic of the congo'],
  ['congo-kinshasa','democratic republic of the congo'], ['congo-brazzaville','congo'],
])

async function pickWorkingToken(){
  const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/query/${dataset}?query=count(*)`
  async function ok(tok){
    if(!tok) return false
    try{
      const r = await fetch(url,{headers:{Authorization:`Bearer ${tok}`}})
      return r.ok
    }catch{ return false }
  }
  if (await ok(TOK_WRITE)) return { token:TOK_WRITE, label:'WRITE' }
  if (await ok(TOK_API))   return { token:TOK_API,   label:'API' }
  return null
}

async function wipeAllPosts(client, dryRun){
  const total = await client.fetch('count(*[_type=="post"])')
  if(dryRun){ console.log(`[wipe] DRY RUN — would delete ${total} post(s).`); return }
  if(!total){ console.log('[wipe] No posts to delete.'); return }
  console.log(`[wipe] Deleting ${total} post(s)…`)
  const BATCH=200; let deleted=0
  while(true){
    const ids = await client.fetch('*[_type=="post"][0...$b]{_id}',{b:BATCH})
    if(!ids.length) break
    const tx = client.transaction()
    for(const { _id } of ids) tx.delete(_id)
    await tx.commit()
    deleted += ids.length
    process.stdout.write(`[wipe] ${deleted}/${total}…\r`)
  }
  process.stdout.write('\n[wipe] Done.\n')
}

// ---- Main ------------------------------------------------------------------
;(async()=>{
  const filePath = path.resolve(process.cwd(), args.file)
  try { await fs.access(filePath) } catch { console.error(`Error: CSV not found at ${filePath}`); process.exit(1) }
  console.log(`[import] reading: ${filePath}`)

  const picked = await pickWorkingToken()
  if(!picked){ console.error('Error: no valid Sanity token (WRITE/API).'); process.exit(1) }
  console.log(`[import] using token: ${picked.label}`)

  const client = createClient({ projectId, dataset, token:picked.token, apiVersion, useCdn:false, perspective:'published' })

  if (args.wipePosts) await wipeAllPosts(client, args.dryRun)

    await wipeSubmittedPosts(client, args.dryRun)


  const raw = await fs.readFile(filePath,'utf8')
  const approxLines = (raw.match(/\n/g)||[]).length + 1

  // 1) Papa (tolerant)
  let parsed
  const papa = Papa.parse(raw, {
    delimiter: args.delimiter || ',',
    skipEmptyLines: 'greedy',
    header: !args.noHeaders,
    quoteChar: '"',
    escapeChar: '"',
    dynamicTyping: false,
    newline: '\n',
  })
  if (papa.errors?.length) {
    console.warn('[parse] Papa warnings (first 3):', papa.errors.slice(0,3))
  }
  parsed = papa.data
  console.log(`[parse] approx lines ~${approxLines}, Papa records: ${Array.isArray(parsed) ? parsed.length : 0}`)

  // 2) Fallback to csv-parse if too few
  if ((Array.isArray(parsed) ? parsed.length : 0) < Math.min(approxLines * 0.5, 10)) {
    console.warn(`[parse] Papa produced only ${parsed.length}. Falling back to csv-parse…`)
    try {
      parsed = parseCsv(raw, {
        bom: true,
        columns: args.noHeaders ? false : (h)=>String(h).replace(/^\uFEFF/,'').trim(),
        skip_empty_lines: true,
        delimiter: args.delimiter,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
        record_delimiter: 'auto',
      })
    } catch (e) {
      console.error('[parse] csv-parse also failed:', e.message)
      process.exit(1)
    }
    console.log(`[parse] csv-parse records: ${Array.isArray(parsed) ? parsed.length : 0}`)
  }

  const rows = (args.noHeaders ? parsed.map(rowFromArray) : parsed.map(rowFromObject))
  if (!rows.length) { console.log('[import] No rows to process.'); process.exit(0) }

  const limited = args.limit>0 ? rows.slice(0,args.limit) : rows
  console.log(`[import] rows in file: ${rows.length}  processing: ${limited.length}  dryRun=${args.dryRun}`)

  // Country lookup
  const countries = await client.fetch('*[_type=="country"]{ _id, title, "regionTitle": region->title }')
  const idxExact = new Map(), idxClean = new Map()
  for (const c of countries){ idxExact.set(normKey(c.title), c); idxClean.set(cleanKey(c.title), c) }
  function resolveCountry(input){
    const raw=norm(input); if(!raw) return null
    const exact=idxExact.get(normKey(raw)); if(exact) return exact
    const syn=COUNTRY_SYNONYMS.get(normKey(raw)); if(syn){ const via=idxExact.get(normKey(syn)); if(via) return via }
    const cleaned=cleanKey(raw); const viaClean=idxClean.get(cleaned); if(viaClean) return viaClean
    for (const [k,c] of idxClean.entries()){ if(k===cleaned || k.includes(cleaned) || cleaned.includes(k)) return c }
    return null
  }


  const docs=[], problems={ missingCountry:[], missingTitle:[], badDate:[], regionMismatch:[] }
  const unmatchedCounts = new Map()

  for (let i=0;i<limited.length;i++){
    const src=limited[i]
    const title=norm(src.title)
    const countryName=norm(src.country)
    const regionName=norm(src.region)
    const website=fixUrl(src.website)
    const emails=splitEmails(src.email)
    const isoDate=toISODate(src.dateJoined)
    const focalpoint=norm(src.focalpoint)

    if(!title){ problems.missingTitle.push({row:i+1}); continue }

    const matchedCountry = resolveCountry(countryName)
    if (!matchedCountry && countryName){
      problems.missingCountry.push({ row:i+1, countryName, title })
      const key=normKey(countryName)||'(empty)'; unmatchedCounts.set(key,(unmatchedCounts.get(key)||0)+1)
    }
    if (matchedCountry && regionName && normKey(regionName)!==normKey(matchedCountry.regionTitle||'')){
      problems.regionMismatch.push({ row:i+1, csvRegion:regionName, country:matchedCountry.title, actualRegion:matchedCountry.regionTitle||'(none)' })
    }

    if (!isoDate && src.dateJoined) problems.badDate.push({ row:i+1, raw:src.dateJoined })

      const fullDescription = mergeDescriptions(src.description, src.description2)
const description = norm(fullDescription) || undefined


    const doc = {
      _type:'post',
      title,
      description, // import description later if you have a column for it
      website: website || undefined,
      emails: emails.length ? emails : undefined,
      focalpoint: focalpoint || undefined,
      datejoined: isoDate || new Date().toISOString().slice(0,10),
      status: args.status==='submitted' ? 'submitted':'published',
      ...(matchedCountry ? { country:{ _type:'reference', _ref: matchedCountry._id } } : (countryName ? { importCountryRaw: countryName } : {})),
    }
    docs.push(doc)
  }

  console.log(`\n[import] prepared docs: ${docs.length}`)
  if (problems.missingTitle.length)   console.log(`  - missing titles: ${problems.missingTitle.length}`)
  if (problems.missingCountry.length) console.log(`  - unmatched country names: ${problems.missingCountry.length}`)
  if (problems.badDate.length)        console.log(`  - unparseable dates: ${problems.badDate.length} (fallback to today)`)
  if (problems.regionMismatch.length) console.log(`  - region mismatches: ${problems.regionMismatch.length}`)

  if (args.dryRun){
    console.log('\n[import] DRY RUN — no writes will be made.')
    console.log(JSON.stringify(docs.slice(0,5), null, 2))
    if (unmatchedCounts.size){
      console.log('\n[import] Top unmatched country names (first 20):')
      const top=[...unmatchedCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20)
      for (const [name,count] of top) console.log(`  - ${name} × ${count}`)
    }
    process.exit(0)
  }

  const CHUNK=100; let written=0
  for (let i=0;i<docs.length;i+=CHUNK){
    const slice=docs.slice(i,i+CHUNK)
    const tx=client.transaction()
    for (const d of slice) tx.create(d)
    await tx.commit()
    written+=slice.length
    console.log(`[import] committed ${written}/${docs.length}`)
  }

  console.log('\n[import] done.')
  if (unmatchedCounts.size) console.log('Note: some rows imported without a country reference (saved as "importCountryRaw").')
  if (problems.regionMismatch.length) console.log(`Note: ${problems.regionMismatch.length} rows had CSV region ≠ country.region (kept country mapping when matched).`)
})().catch((e)=>{ console.error('[import] fatal:', e); process.exit(1) })
