// src/app/api/env-check/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET,
    // DO NOT return the write token
    has_SANITY_WRITE_TOKEN: Boolean(process.env.SANITY_WRITE_TOKEN),
  })
}