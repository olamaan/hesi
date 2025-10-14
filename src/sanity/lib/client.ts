// src/sanity/lib/client.ts
import {createClient} from '@sanity/client'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET!
const apiVersion = (process.env.SANITY_API_VERSION || '2024-10-01').replace(/^v/, 'v')

/** Use this for PUBLIC reads (fast, cached by Sanity CDN) */
export const publicClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: 'published',
})

/** Keep your authenticated client (writes / Studio / server admin) */
export const serverClient = createClient({
  projectId,
  dataset,
  apiVersion,
  token: process.env.SANITY_API_TOKEN || process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
})
