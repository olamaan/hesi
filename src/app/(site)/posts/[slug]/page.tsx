// src/app/posts/[slug]/page.tsx

// add this import near the top with your others
import type { Metadata } from 'next'

// a tiny query just for metadata (keeps page load fast)
const metaQuery = groq`*[_type=="post" && slug.current==$slug][0]{
  title,
  description,
  mainImage
}`

// helper to keep titles short in the tab
const cut = (s?: string, n = 60) =>
  s && s.length > n ? s.slice(0, n - 1) + '…' : s || 'Post'

// put this ABOVE your default export
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { slug } = await params
  const data = await client.fetch(metaQuery, { slug }, { next: { revalidate: 60 } })

  const short = cut(data?.title, 60)
  const site = 'SDGs in Practice' // ← change to your site name

  return {
    title: `${short} | ${site}`,
    description:
      typeof data?.description === 'string'
        ? data.description
        : 'Session details and resources.',
    openGraph: {
      title: short,
      description: 'Session details and resources.',
      // if you have an OG image route, point to it; otherwise omit images
      // images: data?.mainImage ? [{ url: `/api/og?slug=${slug}` }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: short,
      description: 'Session details and resources.',
    },
  }
}



import groq from 'groq'
import { client } from '@/sanity/lib/client'
import { PortableText, type PortableTextComponents } from '@portabletext/react'
import type { PortableTextBlock } from 'sanity'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import Link from 'next/link'
import VideoWithPoster from '@/components/VideoWithPoster'

type RouteParams = { slug: string }
type Props = { params: Promise<RouteParams> }

type RefDoc = { _id: string; title?: string; number?: number }
type Series = { _id: string; title?: string; year?: number; link?: string }

type Post = {
  _id: string
  title?: string
  partners?: string                 // plain text
  description?: PortableTextBlock[]
  links?: Array<{ title: string; url: string }>
  date?: string
  time?: string
  venue?: string
  sdgs?: RefDoc[]
  themes?: Array<RefDoc & { link?: string; image?: SanityImageSource;imageUrl?: string; text?: string }>
  youtube?: string                  // can be YouTube / UN WebTV / Kaltura URL
  series?: Series
  mainImage?: SanityImageSource
  sdgRefs?: string[]
  themeRefs?: string[]
}




const builder = imageUrlBuilder(client)
function urlFor(src: SanityImageSource, w = 1280, h = 720) {
  return builder.image(src).width(w).height(h).fit('crop').auto('format').url()
}

/** Only extracts an ID from real YouTube URLs/IDs */
function getYouTubeId(input?: string): string | null {
  if (!input) return null
  if (/^[\w-]{11}$/.test(input)) return input
  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase()
    if (!(host.includes('youtube.com') || host.includes('youtu.be'))) return null
    if (host.includes('youtu.be')) return url.pathname.replace('/', '')
    const v = url.searchParams.get('v')
    if (v) return v
    const last = url.pathname.split('/').at(-1)
    return last && /^[\w-]{11}$/.test(last) ? last : null
  } catch {
    return null
  }
}

/** Classify source so we render/label correctly */
function getVideoType(input?: string): 'youtube' | 'unwebtv' | 'kaltura' | null {
  if (!input) return null
  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase()
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
    if (host.includes('kaltura.com')) return 'kaltura'
    if (host.includes('un.org') || host.includes('webtv.un.org') || host.includes('media.un.org')) return 'unwebtv'
    return null
  } catch {
    return null
  }
}


function getImageType(
  mainImage?: unknown,
  youtube?: string
): 'upload' | 'youtube' | 'none' {
  if (mainImage) return 'upload'
  if (!mainImage && youtube && getYouTubeId(youtube)) return 'youtube'
  return 'none'
}



 



/** YouTube thumbnail */
function youTubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

// ===== Queries =====
const postQuery = groq`*[_type=="post" && slug.current==$slug][0]{
  _id,
  title,
  partners,
  description,
  links[]{ title, url },
  date,
  time,
  venue,
  sdgs[]->{ _id, title, number },
  themes[]->{ _id, title, link, image, imageUrl, text },
  youtube,
  series->{ _id, title, year, link },
  mainImage,
  "sdgRefs": sdgs[]._ref,
  "themeRefs": themes[]._ref
}`

const relatedQuery = groq`*[
  _type=="post" &&
  _id != $id &&
  (
    count(sdgs[@._ref in $sdgRefs]) > 0 ||
    count(themes[@._ref in $themeRefs]) > 0
  )
] | order(
  (count(sdgs[@._ref in $sdgRefs]) + count(themes[@._ref in $themeRefs])) desc,
  date desc
)[0...5]{
  _id,
  title,
  slug,
  partners,
  mainImage,
  youtube,
  "sdgNums": sdgs[]->number
}`

// ===== PortableText renderers =====
const components: PortableTextComponents = {
  block: {
    h1: ({ children }) => <h1 className="pt-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="pt-h2">{children}</h2>,
    normal: ({ children }) => <p className="pt-p">{children}</p>,
  },
  list: {
    bullet: ({ children }) => <ul className="pt-ul">{children}</ul>,
    number: ({ children }) => <ol className="pt-ol">{children}</ol>,
  },
}

// ===== Icons =====
function DateIcon() { return (<svg className="detail-icon" viewBox="0 0 24 24" aria-hidden><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 6H4v12h16V8z" /></svg>) }
function TimeIcon() { return (<svg className="detail-icon" viewBox="0 0 24 24" aria-hidden><path d="M12 1a11 11 0 1 0 11 11A11.013 11.013 0 0 0 12 1zm1 11h5v2h-7V6h2z" /></svg>) }
function VenueIcon() { return (<svg className="detail-icon" viewBox="0 0 24 24" aria-hidden><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z" /></svg>) }
function DocIcon() { return (<svg className="detail-icon" viewBox="0 0 24 24" aria-hidden><path d="M14 2H6v20h12V8zm0 2.5L17.5 8H14z" /></svg>) }
function SeriesIcon() { return (<svg className="detail-icon" viewBox="0 0 24 24" aria-hidden><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h12v2H3v-2z" /></svg>) }
function PartnersIcon() { return (<svg className="detail-icon" viewBox="0 0 24 24" aria-hidden><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h6v-2c0-1.1.9-2 2-2h2.5c-.25-.5-.5-1-.5-1.5 0-.17.02-.33.05-.5H8zm8 0c-.29 0-.62.02-.95.05.58.73.95 1.64.95 2.65V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z"/></svg>) }
function SdgsIcon() { return (<img src="/images/sdg-wheel.svg" alt="SDG Wheel" className="detail-icon" />) }
function ThemesIcon() { return (<svg className="detail-icon" viewBox="0 0 24 24" aria-hidden><path d="M20 10V4h-6l-2-2H4c-1.1 0-2 .9-2 2v6l2 2v10h6l2 2h6c1.1 0 2-.9 2-2v-6l2-2z"/></svg>) }
function DescriptionIcon() {
  return (
    <svg className="detail-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 2h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H4a1 
        1 0 0 1-1-1V3a1 1 0 0 1 1-1zm2 4v2h12V6H6zm0 
        4v2h12v-2H6zm0 4v2h8v-2H6z" />
    </svg>
  )
}


// ===== Page =====
export default async function PostPage({ params }: Props) {
  const { slug } = await params
  const post = (await client.fetch(postQuery, { slug })) as Post

  if (!post) {
    return (
      <main className="post-page post-page--notfound">
        <p>Post not found</p>
      </main>
    )
  }


  // inside PostPage, after you've fetched `post`
const studioBase =
  process.env.NEXT_PUBLIC_STUDIO_URL      // e.g. "https://studio.yoursite.org" (optional)
  ?? process.env.NEXT_PUBLIC_STUDIO_BASE  // e.g. "/studio" (optional)
  ?? '/studio';                           // default (embedded studio)


  const studioEditHref =
  `${studioBase}/desk/intent/edit/id=${encodeURIComponent(post._id)};type=post`



  
  
  // Related
  const related = (await client.fetch(
    relatedQuery,
    { id: post._id, sdgRefs: post.sdgRefs ?? [], themeRefs: post.themeRefs ?? [] },
    { cache: 'no-store' }
  )) as Array<{
    _id: string
    title: string
    slug?: { current?: string }
    partners?: string
    mainImage?: SanityImageSource
    youtube?: string
    sdgNums?: number[]
  }>



  // Poster logic (YouTube thumb vs Studio image)
  const videoType = getVideoType(post.youtube)
  const imageType = getImageType(post.mainImage, post.youtube)


  const ytId = videoType === 'youtube' ? getYouTubeId(post.youtube) : null

  const hasStudioImage  = Boolean(post.mainImage)
  const isYouTubePoster = !hasStudioImage && Boolean(ytId)

  const posterUrl = hasStudioImage
    ? urlFor(post.mainImage as SanityImageSource, 1280, 720)
    : ytId
      ? youTubeThumb(ytId)
      : undefined

  const prettyDate = post.date
    ? new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : undefined

  return (
    <main className="post-page">

      {/* Admin: quick edit link (temporary) 
 
<div className="admin-bar">
  <a className="admin-link" href={studioEditHref} target="_blank" rel="noopener noreferrer">
    Edit this post in Studio ↗
  </a>
</div>
*/}


      <div className="post-two-col">
        <div className="post-main">




{/* 1) HERO — poster overlay for both YouTube and Kaltura */}
{ytId ? (
  // YouTube: overlay poster (Studio image preferred via your existing `posterUrl`)
  <section className="post-hero post-hero--youtube">
    <div className="post-hero__media post-hero__media--youtube">
      <VideoWithPoster
        posterUrl={posterUrl} // studio image if present, otherwise YT thumb
        youtubeId={ytId}
        alt={post.title ?? 'Session video'}
      />
    </div>
  </section>
) : videoType === 'kaltura' ? (
  hasStudioImage ? (
    // Kaltura WITH studio image → overlay poster + click-to-play iframe
    <section className="post-hero post-hero--kaltura">
      <div className="post-hero__media post-hero__media--kaltura">
        <VideoWithPoster
          provider="kaltura"
          posterUrl={urlFor(post.mainImage as SanityImageSource, 1280, 720)}
          embedSrc={post.youtube!}
          alt={post.title ?? 'Kaltura player'}
        />
      </div>
    </section>
  ) : (
    // Kaltura WITHOUT studio image → immediate iframe
    <section className="post-hero post-hero--kaltura">
      <div className="post-hero__media post-hero__media--iframe">
        <iframe
          src={post.youtube}
          title={post.title ?? 'Kaltura player'}
          allow="autoplay; fullscreen; encrypted-media"
          allowFullScreen
          style={{ width: '100%', height: 480, border: 'none' }}
        />
      </div>
    </section>
  )
) : (
  // No recognized video → if youtube field is empty and there's a studio image, show it
  (post.youtube?.trim() ? null : hasStudioImage ? (
    <section className="post-hero post-hero--image">
      <div className="post-hero__media post-hero__media--image">
        <img
          src={urlFor(post.mainImage as SanityImageSource, 1280, 720)}
          alt={post.title ?? 'Session image'}
          className="post-hero__img post-hero__img--studio"
        />
      </div>
    </section>
  ) : null)
)}





          {/* 2) Title */}
          {post.title && <h1 className="post-title">{post.title}</h1>}

          {/* 3) Meta blocks */}
          {post.partners ? (
            <div className="meta-card" role="region" aria-label="Partners" style={{ marginBottom: 10 }}>
              <div className="meta-label"><PartnersIcon /> Partners</div>
              <div className="meta-value">{post.partners}</div>
            </div>
          ) : null}

          {post.description?.length ? (
            <div className="meta-card" role="region" aria-label="Description">
              <div className="meta-label"><DescriptionIcon /> Description</div>
              <div className="meta-value">
                <PortableText value={post.description} components={components} />
              </div>
            </div>
          ) : null}

          <section className="post-meta-grid">
            {/* Links */}
            {post.links?.length ? (
              <div className="meta-card" role="region" aria-label="Links">
                <div className="meta-label"><DocIcon /> Links</div>
                <ul className="meta-links">
                  {post.links.map((l, i) => {
                    if (!l?.url) return null
                    let fallback = ''
                    try { fallback = new URL(l.url).hostname.replace(/^www\./, '') } catch {}
                    const label = l.title?.trim() || fallback || 'Open link'
                    return (
                      <li key={`${l.url}-${i}`}>
                        <a className="library_link" href={l.url} target="_blank" rel="noopener noreferrer" title={label}>
                          {label} →
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {(prettyDate || post.time) && (
              <div className="meta-card" role="region" aria-label="Date and time">
                <div className="meta-label"><DateIcon /> Date / Time</div>
                <div className="meta-value">
                  {prettyDate ? <div>{prettyDate}</div> : null}
                  {post.time ? (<div className="meta-inline"><TimeIcon /> {post.time}</div>) : null}
                </div>
              </div>
            )}

            {post.venue && (
              <div className="meta-card" role="region" aria-label="Venue">
                <div className="meta-label"><VenueIcon /> Venue</div>
                <div className="meta-value">{post.venue}</div>
              </div>
            )}

            {post.series && (
              <div className="meta-card" role="region" aria-label="Series">
                <div className="meta-label"><SeriesIcon /> Series</div>
                <div className="meta-value">
                  {post.series.link ? (
                    <a className="library_link" href={post.series.link} target="_blank" rel="noopener noreferrer">
                      {post.series.title || (post.series.year ? `${post.series.year} SDGs in Practice` : 'Series')}
                    </a>
                  ) : (
                    post.series.title || (post.series.year ? `${post.series.year} SDGs in Practice` : 'Series')
                  )}
                </div>
              </div>
            )}

            {post.sdgs?.length ? (
              <div className="meta-card" role="region" aria-label="SDGs">
                <div className="meta-label"><SdgsIcon /> SDGs</div>
                <div className="meta-value">
                  <div className="sdg-dots">
                    {post.sdgs
                      .filter(s => typeof s.number === 'number')
                      .sort((a, b) => (a.number! - b.number!))
                      .map(s => (
                        <span
                          key={s._id}
                          className={`sdg-dot sdg-${s.number}`}
                          title={`SDG ${s.number}: ${s.title}`}
                          aria-label={`SDG ${s.number}: ${s.title}`}
                        />
                      ))}
                  </div>
                </div>
              </div>
            ) : null}

            {post.themes?.length ? (
              <div className="meta-card" role="region" aria-label="Themes">
                <div className="meta-label"><ThemesIcon /> Themes</div>
                <div className="meta-value">
                  {post.themes.map(t => t.title).filter(Boolean).join(', ')}
                </div>
              </div>
            ) : null}
          </section>

          {/* Learn more */}
          {(post.sdgs?.length || post.themes?.length) ? (
            <section className="info-section" aria-labelledby="learnmore-heading">
              <h2 id="learnmore-heading" className="library_h2">Learn more</h2>

              <div className="info-grid">
                {/* SDGs (first 3 unique) */}
                {Array.from(new Set((post.sdgs || [])
                  .filter(s => typeof s.number === 'number')
                  .map(s => s.number as number)))
                  .sort((a,b) => a - b)
                  
                  .map(n => {
                    const url = `https://sdgs.un.org/goals/goal${n}`
                    const imgSrc = `/sdgprogress/SDG-Report-2025-Goal-${n}.png`
                    return (
                      <a
                        key={`sdg-${n}`}
                        className="info-card-link"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Learn more about SDG ${n}`}
                      >
                        <article className="info-card">
                          <img className="info-image" src={imgSrc} alt={`SDG ${n} progress snapshot`} />
                          <div className="info-content">
                            <header className="info-header" style={{display:'flex',alignItems:'center',gap:8}}>
                              <span className={`sdg-dot sdg-${n}`} aria-hidden />
                              <h3 className="info-title">SDG {n}</h3>
                            </header>
                            <div className="info-link library_link">Read more on sdgs.un.org →</div>
                          </div>
                        </article>
                      </a>
                    )
                  })}

{/* List related Themes */}
{(post.themes || []).map((t) => {
  // Prefer external imageUrl; otherwise use uploaded image
  const imgUrl = t.imageUrl
    ? t.imageUrl
    : t.image
    ? imageUrlBuilder(client)
        .image(t.image)
        .width(640)
        .height(360)
        .fit('crop')
        .auto('format')
        .url()
    : undefined

  const Card = (
    <article className="info-card" key={`theme-${t._id}`}>
      {imgUrl && (
        <img
          className="info-image-theme"
          src={imgUrl}
          alt={t.title ?? 'Theme image'}
        />
      )}
      <div className="info-content">
        <header className="info-header">
          <h3 className="info-title">{t.title}</h3>
        </header>
        {t.text ? <div className="info-body">{t.text}</div> : null}
        <div className="info-link library_link">Learn more →</div>
      </div>
    </article>
  )

  return t.link?.startsWith('/') ? (
    <Link
      key={`theme-link-${t._id}`}
      href={t.link}
      className="info-card-link"
      aria-label={`Explore ${t.title}`}
    >
      {Card}
    </Link>
  ) : (
    <a
      key={`theme-link-${t._id}`}
      href={t.link}
      target="_blank"
      rel="noopener noreferrer"
      className="info-card-link"
      aria-label={`Explore ${t.title}`}
    >
      {Card}
    </a>
  )
})}



              </div>
            </section>
          ) : null}
        </div>

        {/* ===== Related sidebar ===== */}
        <aside className="post-related">
          <Link href="/"><button className="returnButton" title="Return to the Library">Return to the Library</button></Link>

          <h2>Related sessions</h2>
          <ul className="related-list">
            {related?.map(r => {
              const href = `/posts/${r.slug?.current ?? ''}`
              const vt = getVideoType(r.youtube)
              const id = vt === 'youtube' ? getYouTubeId(r.youtube) : null

              return (
                <li key={r._id} className="related-item">
                  <Link href={href} className="related-link" aria-label={r.title}>
<div className="related-thumb">
  {r.mainImage ? (
    <img
      src={urlFor(r.mainImage as SanityImageSource, 420, 236)}
      alt={r.title ?? 'Related session'}
      className="related-thumb__img related-thumb--studio"
    />
  ) : id ? (
    <img
      src={youTubeThumb(id)}
      alt={`${r.title ?? 'Related session'} thumbnail`}
      className="related-thumb__img related-thumb--youtube"
    />
  ) : (
    <img
      src="/images/bg3.png"
      alt={r.title ?? 'Related session'}
      className="related-thumb__img related-thumb--fallback"
    />
  )}
</div>

                    <div className="related-body">
                      <div className="related-title-text">{r.title}</div>
                    </div>
                  </Link>
                </li>
              )
            })}
            {!related?.length && <li className="related-none">No related sessions.</li>}
          </ul>
        </aside>
      </div>
    </main>
  )
}
