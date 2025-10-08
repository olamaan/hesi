// src/app/api/submit-health/route.ts
import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  hasWriteToken: Boolean(process.env.SANITY_WRITE_TOKEN),
  hasApiToken: Boolean(process.env.SANITY_API_TOKEN),
})

}
