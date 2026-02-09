// src/components/HomeHero.tsx
import Link from 'next/link'
import { publicClient as client } from '@/sanity/lib/client'

type Item = {
  _id: string
  title: string
  website?: string
  datejoined?: string
  countryTitle?: string
  regionTitle?: string
}

const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n)

const formatYear = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear())
}

function buildHrefWithParams(nextParams: Record<string, string | string[] | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(nextParams)) {
    if (v == null) continue
    if (Array.isArray(v)) v.forEach((val) => sp.append(k, val))
    else sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `/?${qs}` : '/'
}

function clearSearchHref(current: { [k: string]: string | string[] | undefined }) {
  return buildHrefWithParams({ ...current, q: undefined, page: undefined })
}

/* ------------------------------------------------------------------
   OPTIONAL (commented out): badges / activities
   Keeping placeholders so you can re-enable later.
------------------------------------------------------------------- */

// type BadgeType = 'forum' | 'network' | 'cop' | 'action'
// export function Badge(...) { ... }

export default async function HomeHero({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const sp = searchParams ?? {}

  // Search by org & country (q)
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q
  const q = (qRaw || '').trim()
  const qPattern = q ? `*${q.toLowerCase()}*` : null

  // pagination
  const perPage = 30
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const start = (page - 1) * perPage
  const end = start + perPage

  const { items, total, publishedTotal } = await client.fetch<{
    items: Item[]
    total: number
    publishedTotal: number
  }>(
    /* groq */ `{
      "items": *[
        _type == "post" &&
        lower(status) == "published" &&
        (
          $qPattern == null ||
          lower(title) match $qPattern ||
          lower(country->title) match $qPattern ||
          lower(website) match $qPattern
        )
      ] | order(datejoined desc, _createdAt desc)[$start...$end]{
        _id, title, datejoined, website,
        "countryTitle": country->title,
        "regionTitle": country->region->title
      },

      "total": count(*[
        _type == "post" &&
        lower(status) == "published" &&
        (
          $qPattern == null ||
          lower(title) match $qPattern ||
          lower(country->title) match $qPattern ||
          lower(website) match $qPattern
        )
      ]),

      "publishedTotal": count(*[
        _type == "post" &&
        lower(status) == "published"
      ])
    }`,
    { start, end, qPattern },
    {
      next: { revalidate: 60, tags: ['homehero'] },
      cache: 'force-cache',
    },
  )

  const shownTo = start + items.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageHref = (p: number) => buildHrefWithParams({ ...sp, page: p > 1 ? String(p) : undefined })

  return (
    <>
      {/* Hero + right column content */}
      <div className="post-two-col">
        <div className="post-main">
          <div className="hesiBanner">
            <div className="hesiBanner__overlay" aria-hidden="true" />
            <div className="hesiBanner__inner">
              <div className="hesiBanner__container container">
                <div className="hesiBanner__eyebrow">The HESI Community</div>
                <div className="hesiBanner__title">
                  The HESI community consists of UN entities, university networks, student organizations, and higher
                  education institutions committed to advancing sustainable development
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="post-related">
          <img
            src="images/HESI-logo-horizontal.png"
            className="library_image"
            style={{ marginBottom: '10px', marginTop: '0px' }}
            alt="HESI"
          />
          HESI is chaired by the United Nations Department of Economic and Social Affairs (UN DESA), UN University,
          UNESCO International Institute for Higher Education in Latin America and the Caribbean (IESALC), and the
          Sulitest Association. Other UN partners include UNESCO, UN Environment Programme, UN Global Compact’s
          Principles for Responsible Management Education initiative, UN-HABITAT, UNCTAD, UNITAR, UN Office for
          Partnerships, and UN Academic Impact.
          <p></p>
          <p className="hesi-cta">
            <a href="https://sdgs.un.org/HESI" target="_blank" rel="noopener noreferrer" className="hesiLink">
              Visit the HESI main website
              <svg
                className="hesiLink__icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </p>
          <p></p>
        </aside>
      </div>

      <div className="homehero-layout">
        {/* LEFT: counter + search */}
        <aside className="filters">
          <div className="results-bar results-bar--stack">
            <span className={`results-count${total === 0 ? ' is-zero' : ''}`}>{formatNumber(total)}</span>
            <span className="results-label">results</span>
          </div>

          {/* Search by Org & country */}
          <div className="filter_menu filter-menu--spaced" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong>Search by Org &amp; country</strong>
            {q && (
              <Link className="reset-link" href={clearSearchHref(sp)} prefetch={false}>
                Clear
              </Link>
            )}
          </div>

          <form className="filter-search" method="get" action="/">
            <input
              className="filter-search__input"
              name="q"
              defaultValue={q}
              placeholder="Type org name/country…"
              aria-label="Search members by title or country"
            />
            <button className="filter-search__button" type="submit">
              Search
            </button>
          </form>

          <div className="joinBox">
            <div className="filter_menu filter-menu--spaced">Join HESI</div>
            Be part of a global community of universities, networks, and organizations advancing sustainability through
            higher education.
            <p></p>
            <Link href="/join">
              <button className="theButton">Join now</button>
            </Link>
          </div>
        </aside>

        {/* RIGHT: list & pagers */}
        <section className="cards">
          <div className="hesiBanner__eyebrow_small">{formatNumber(publishedTotal)} Members</div>

          {/* TOP PAGER */}
          <div className="pager3 pager3--top">
            <div className="pager3__prev">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} prefetch={false} className="btn-pager" aria-label="Previous page">
                  ← Previous
                </Link>
              ) : (
                <span className="btn-pager" aria-disabled="true">
                  ← Previous
                </span>
              )}
            </div>

            <nav className="pager3__nums pagination" aria-label="Pagination">
              {(() => {
                const max = 7
                const windowSize = 2
                let list: (number | string)[] = []
                if (totalPages <= max) {
                  list = Array.from({ length: totalPages }, (_, i) => i + 1)
                } else {
                  const startN = Math.max(2, page - windowSize)
                  const endN = Math.min(totalPages - 1, page + windowSize)
                  list = [1]
                  if (startN > 2) list.push('…')
                  for (let i = startN; i <= endN; i++) list.push(i)
                  if (endN < totalPages - 1) list.push('…')
                  list.push(totalPages)
                }

                return list.map((p, idx) =>
                  typeof p === 'string' ? (
                    <span key={`e${idx}`} className="pagination__ellipsis">
                      …
                    </span>
                  ) : p === page ? (
                    <span key={p} className="pagination__link is-active" aria-current="page">
                      {p}
                    </span>
                  ) : (
                    <Link key={p} href={pageHref(p)} prefetch={false} className="pagination__link">
                      {p}
                    </Link>
                  ),
                )
              })()}
            </nav>

            <div className="pager3__next">
              {shownTo < total ? (
                <Link href={pageHref(page + 1)} prefetch={false} className="btn-pager" aria-label="Next page">
                  Next →
                </Link>
              ) : (
                <span className="btn-pager" aria-disabled="true">
                  Next →
                </span>
              )}
            </div>
          </div>

          <ul className="list-plain">
            {items.map((it) => {
              const detailsHref = `/member/${encodeURIComponent(it._id)}`

              return (
                <li key={it._id} className="row-item">
                  <details className="row-details">
                    <summary className="row-summary">
                      <div className="row-summary__left">
                        <div className="row-summary__title">{it.title}</div>
                      </div>

                      {/* Badges removed */}
                    </summary>

                    <div className="row-details__body">
                      <div className="muted row-summary__meta">
                        <div className="row-meta">
                          <ul className="row-meta__list row-meta__list--stacked">
                            <li className="row-meta__item">
                              <img className="row-meta__icon" src="/images/icons/geo.svg" alt="" aria-hidden="true" />
                              <span>{it.countryTitle ?? '—'}</span>
                            </li>

                            {formatYear(it.datejoined) && (
                              <li className="row-meta__item">
                                <img className="row-meta__icon" src="/images/icons/calendar.svg" alt="" aria-hidden="true" />
                                <span>{formatYear(it.datejoined)}</span>
                              </li>
                            )}

                            {it.website && (
                              <li className="row-meta__item">
                                <img className="row-meta__icon" src="/images/icons/link.svg" alt="" aria-hidden="true" />
                                <a className="webLink" href={it.website} target="_blank" rel="noopener noreferrer">
                                  {it.website}
                                </a>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Activities removed */}

                      <div style={{ marginTop: 12 }}>
                        <Link href={detailsHref} prefetch={false} className="btn-pager">
                          View full profile →
                        </Link>
                      </div>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>

          {/* BOTTOM PAGER */}
          <div className="pager3 pager3--bottom">
            <div className="pager3__prev">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} prefetch={false} className="btn-pager" aria-label="Previous page">
                  ← Previous
                </Link>
              ) : (
                <span className="btn-pager" aria-disabled="true">
                  ← Previous
                </span>
              )}
            </div>

            <nav className="pager3__nums pagination" aria-label="Pagination">
              {(() => {
                const max = 7
                const windowSize = 2
                let list: (number | string)[] = []
                if (totalPages <= max) {
                  list = Array.from({ length: totalPages }, (_, i) => i + 1)
                } else {
                  const startN = Math.max(2, page - windowSize)
                  const endN = Math.min(totalPages - 1, page + windowSize)
                  list = [1]
                  if (startN > 2) list.push('…')
                  for (let i = startN; i <= endN; i++) list.push(i)
                  if (endN < totalPages - 1) list.push('…')
                  list.push(totalPages)
                }

                return list.map((p, idx) =>
                  typeof p === 'string' ? (
                    <span key={`e${idx}`} className="pagination__ellipsis">
                      …
                    </span>
                  ) : p === page ? (
                    <span key={p} className="pagination__link is-active" aria-current="page">
                      {p}
                    </span>
                  ) : (
                    <Link key={p} href={pageHref(p)} prefetch={false} className="pagination__link">
                      {p}
                    </Link>
                  ),
                )
              })()}
            </nav>

            <div className="pager3__next">
              {shownTo < total ? (
                <Link href={pageHref(page + 1)} prefetch={false} className="btn-pager" aria-label="Next page">
                  Next →
                </Link>
              ) : (
                <span className="btn-pager" aria-disabled="true">
                  Next →
                </span>
              )}
            </div>
          </div>

          {items.length === 0 && <p className="empty-state">No entries match these filters.</p>}
        </section>
      </div>
    </>
  )
}
