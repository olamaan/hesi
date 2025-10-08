'use client'

import { NextStudio } from 'next-sanity/studio'
import config from '../../../../../sanity.config' // adjust ../../ as needed from this file

export default function StudioPage() {
  return <NextStudio config={config} />
}
