import fs from 'node:fs'
import countries from 'world-countries' // <- no 'assert' needed

// UN members + 2 observers (Holy See + State of Palestine)
const keepAlso = new Set(['VAT', 'PSE'])

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

const docs = countries
  .filter(c => c.unMember || keepAlso.has(c.cca3))
  .map(c => ({
    _id: `country-${slugify(c.name.common)}-${c.cca3.toLowerCase()}`,
    _type: 'country',
    title: c.name.common,
  }))
  .sort((a, b) => a.title.localeCompare(b.title))

fs.writeFileSync('countries.ndjson', docs.map(d => JSON.stringify(d)).join('\n'))
console.log(`Wrote countries.ndjson with ${docs.length} docs`)
