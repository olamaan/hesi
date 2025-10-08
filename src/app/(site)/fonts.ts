// src/app/fonts.ts
import { Roboto, Oswald } from 'next/font/google'

export const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '700'], variable: '--font-roboto' })
export const oswald = Oswald({ subsets: ['latin'], weight: ['200','300','400','500','600','700'], variable: '--font-oswald' })
