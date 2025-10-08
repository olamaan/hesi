// src/app/layout.tsx
/* eslint-disable @next/next/no-css-tags */

import './globals.css'
import type { Metadata } from 'next'
import { Oswald, Roboto } from 'next/font/google'

const oswald = Oswald({ subsets: ['latin'], weight: ['400','500','600','700'], display: 'swap' })
const roboto = Roboto({ subsets: ['latin'], weight: ['400','500','700'], display: 'swap' })

export const metadata: Metadata = {
  title: 'HESI Community',
  description: '',
  icons: { icon: 'https://sdgs.un.org/themes/custom/porto/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* Viewport / compatibility */}
        <meta name="MobileOptimized" content="width" />
        <meta name="HandheldFriendly" content="true" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />

        {/* External CSS from sdgs.un.org */}
        <link href="https://sdgs.un.org/themes/custom/porto/css/bundle.css?qpptv2" rel="stylesheet" />
        <link href="https://sdgs.un.org/themes/custom/porto/css/style.css?qpptv2" rel="stylesheet" />
        <link href="https://sdgs.un.org/themes/custom/porto/color/preview.css?qpptv2" rel="stylesheet" />

        {/* Your local CSS */}
        <link href="/styles/library.css" rel="stylesheet" />
      </head>

      <body
        className={[
          oswald.className,
          roboto.className,
          'layout-no-sidebars',
          'page-taxonomy-term-1188',
          'page-vocabulary-topics',
          'page-view-taxonomy-term',
          'dir-ltr',
          'lang-en',
          'path-taxonomy',
        ].join(' ')}
      >
        {children}
      </body>
    </html>
  )
}
