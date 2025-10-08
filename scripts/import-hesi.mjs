#!/usr/bin/env node
// Usage:
//   Dry run first 50 rows:
//     node scripts/import-hesi.mjs --file data/hesi.csv --no-headers --delimiter ',' --dry-run --limit 50
//   Real import (wipe posts first):
//     node scripts/import-hesi.mjs --file data/hesi.csv --no-headers --delimiter ',' --wipe-posts
//   Import as submitted:
//     node scripts/import-hesi.mjs --file data/hesi.csv --no-headers --delimiter ',' --status submitted

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import { createClient } from '@sanity/client'
import PapaModule from 'papaparse'               // ✅ safe import
import { parse as parseCsv } from 'csv-parse/sync'

const Papa = (()=>{
  // Handles different builds of papaparse
  if (PapaModule && typeof PapaModule.parse === 'function') return PapaModule
  if (PapaModule && typeof PapaModule === 'function') return { parse: PapaModule }
  if (PapaModule?.default && typeof PapaModule.default.parse === 'function') return PapaModule.default
  throw new Error('papaparse import failed')
})()

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true, quiet: true })
dotenv.config({ quiet: true })

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET
const apiVersionRaw = process.env.SANITY_API_VERSION || '2024-10-01'
const apiVersion = apiVersionRaw.startsWith('v') ? apiVersionRaw : `v${apiVersionRaw}`

const TOK_WRITE = (process.env.SANITY_WRITE_TOKEN || '').trim()
const TOK_API   = (process.env.SANITY_API_TOKEN   || '').trim()

function getArgs(argv){
  const out = { file:null, dryRun:false, status:'published', delimiter:',', limit:0, wipePosts:false, noHeaders:false }
  const a = argv.slice(2)
  for (let i=0;i<a.length;i++){
    const k=a[i]
    if (k==='--file') out.file=a[++i]
    else if (k==='--dry-run') out.dryRun=true
    else if (k==='--status') out.status=String(a[++i]).toLowerCase()
    else if (k==='--delimiter') out.delimiter=a[++i]
    else if (k==='--limit') out.limit=Number(a[++i]||0)
    else if (k==='--wipe-posts'||k==='--wipe') out.wipePosts=true
    else if (k==='--no-headers') out.noHeaders=true
  }
  return out
}
const args = getArgs(process.argv)

if (!args.file){ console.error('Error: --file <path/to.csv> is required'); process.exit(1) }
if (!projectId || !dataset){ console.error('Error: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET'); process.exit(1) }

const filePath = path.resolve(process.cwd(), args.file)
try { await fs.access(filePath) } catch { console.error(`Error: CSV not found at ${filePath}`); process.exit(1) }
console.log(`[import] reading: ${filePath}`)

async function pickWorkingToken(){
  const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/query/${dataset}?query=count(*)`
  async function ok(tok){ if(!tok) return false; try{ const r=await fetch(url,{headers:{Authorization:`Bearer ${tok}`}}); return r.ok }catch{ return false } }
  if (await ok(TOK_WRITE)) return { token:TOK_WRITE, label:'WRITE' }
  if (await ok(TOK_API))   return { token:TOK_API,   label:'API' }
  return null
}

const norm = (s)=> (s??'').toString().trim()
const normKey = (s)=> norm(s).toLowerCase()
const stripDiacritics = (s)=> s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
const cleanKey = (s)=> stripDiacritics(String(s)).toLowerCase().replace(/\(.*?\)/g,'').replace(/&/g,'and').replace(/[^a-z0-9]/g,'')
const fixUrl = (u)=>{ const s=norm(u); if(!s) return ''; if(/^https?:\/\//i.test(s)) return s; return `https://${s}` }
function splitEmails(v){
  if(!v) return []
  const raw = Array.isArray(v)? v.join(','): String(v)
  return raw.split(/[,\s;]+/).map(e=>e.trim()).filter(e=>e && e.includes('@')).filter((e,i,a)=>a.indexOf(e)===i)
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

// no-headers row mapper (pads to 7)
function rowFromArray(arr){
  const a=[...arr]; while(a.length<7) a.push('')
  return { title:a[0], typeOfOrg:a[1], country:a[2], dateJoined:a[3], region:a[4], website:a[5], email:a[6] }
}
// headers mapper (kept for completeness)
function rowFromObject(row){
  const pick=(al)=>{ for(const k of al) if(row[k]!=null && row[k]!=='') return row[k]; return undefined }
  return {
    title: pick(['title','name','organization','organisation','org','org name','entry title']),
    typeOfOrg: pick(['type of org','type','org type','organization type','organisation type']),
    country: pick(['country','country name']),
    dateJoined: pick(['date joined','joined','join date','date','date_joined']),
    region: pick(['region','subregion','area']),
    website: pick(['website','url','link']),
    email: pick(['email','emails','e-mail','contact email']),
  }
}

// synonyms → canonical UN titles (extend as needed)
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

;(async()=>{
  const picked = await pickWorkingToken()
  if(!picked){ console.error('Error: no valid Sanity token (WRITE/API).'); process.exit(1) }
  console.log(`[import] using token: ${picked.label}`)

  const client = createClient({ projectId, dataset, token:picked.token, apiVersion, useCdn:false, perspective:'published' })

  if (args.wipePosts) await wipeAllPosts(client, args.dryRun)

  const raw = await fs.readFile(filePath,'utf8')
  const approxLines = (raw.match(/\n/g)||[]).length + 1

  // 1) Try Papa first (very tolerant)
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

  // 2) If suspiciously few, fall back to csv-parse (relaxed)
  if ((Array.isArray(parsed) ? parsed.length : 0) < Math.min(approxLines * 0.5, 10)) {
    console.warn(`[parse] Papa produced only ${parsed.length}. Falling back to csv-parse…`)
    try {
      parsed = parseCsv(raw, {
        bom: true,
        columns: args.noHeaders ? false : (h)=>String(h).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,' '),
        skip_empty_lines: true,
        delimiter: args.delimiter,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
        record_delimiter: 'auto',
        // skip_records_with_error: true, // uncomment to drop bad rows
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

  // Build country lookup
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

    const doc = {
      _type:'post',
      title,
      // description: src.typeOfOrg ? `Type of org: ${norm(src.typeOfOrg)}` : undefined,
      website: website || undefined,
      emails: emails.length ? emails : undefined,
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
    const tx=client.transaction(); for (const d of slice) tx.create(d); await tx.commit()
    written+=slice.length; console.log(`[import] committed ${written}/${docs.length}`)
  }
  console.log('\n[import] done.')
  if (unmatchedCounts.size) console.log('Note: some rows imported without a country reference (saved as "importCountryRaw").')
  if (problems.regionMismatch.length) console.log(`Note: ${problems.regionMismatch.length} rows had CSV region ≠ country.region (kept country mapping when matched).`)
})().catch((e)=>{ console.error('[import] fatal:', e); process.exit(1) })
