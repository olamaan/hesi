// src/components/HomeHero.tsx
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { client } from '@/sanity/lib/client'

/** Six canonical regions */
const CANON = [
  { id: 'region.africa',        title: 'Africa' },
  { id: 'region.asia-pacific',  title: 'Asia-Pacific' },
  { id: 'region.europe',        title: 'Europe' },
  { id: 'region.lac',           title: 'Latin America and the Caribbean' },
  { id: 'region.north-america', title: 'North America' },
  { id: 'region.western-asia',  title: 'Western Asia' },
]

const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n)

type Item = {
  _id: string
  title: string
  description?: string
  website?: string
  datejoined?: string
  countryTitle?: string
  regionTitle?: string
}

function toArray(v?: string | string[]): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

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

// toggle region & reset page
function toggleRegionHref({
  current,
  id,
}: {
  current: { [k: string]: string | string[] | undefined }
  id: string
}) {
  const chosen = toArray(current.region)
  const exists = chosen.includes(id)
  const next = exists ? chosen.filter((x) => x !== id) : [...chosen, id]
  const { page: _drop, ...rest } = current
  return buildHrefWithParams({ ...rest, region: next.length ? next : undefined })
}

// set sort & reset page
function sortHref(current: { [k: string]: string | string[] | undefined }, sort: 'joined' | 'title') {
  const { page: _drop, ...rest } = current
  return buildHrefWithParams({ ...rest, sort })
}

// clear search & reset page
function clearSearchHref(current: { [k: string]: string | string[] | undefined }) {
  const { page: _drop, q: _drop2, ...rest } = current
  return buildHrefWithParams({ ...rest })
}

export default async function HomeHero({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  noStore()

  const sp = searchParams ?? {}

  // title search (q)
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q
  const q = (qRaw || '').trim()
  const qPattern = q ? `*${q.toLowerCase()}*` : null

  // filters
  const selectedRegionIds = toArray(sp.region)
  const filterRegionIds = selectedRegionIds.length ? selectedRegionIds : null

  // sort
  const sortParam = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort
  const sort: 'joined' | 'title' = sortParam === 'title' ? 'title' : 'joined'

  // pagination
  const perPage = 20
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const start = (page - 1) * perPage
  const end = start + perPage

  const { items, total, publishedTotal } = await client.fetch<{
    items: Item[]
    total: number
    publishedTotal: number
  }>(
    `{
      "items": select(
        $sort == "title" =>
          *[
            _type == "post" &&
            lower(status) == "published" &&
            (
              $filterRegionIds == null ||
              country._ref in *[
                _type == "country" &&
                defined(region._ref) &&
                region._ref in $filterRegionIds
              ]._id
            ) &&
   (
  $qPattern == null ||
  lower(title) match $qPattern ||
  lower(country->title) match $qPattern
)


          ] | order(title asc)[$start...$end]{
            _id, title, datejoined, description, website,
            "countryTitle": country->title,
            "regionTitle": country->region->title
          },
          *[
            _type == "post" &&
            lower(status) == "published" &&
            (
              $filterRegionIds == null ||
              country._ref in *[
                _type == "country" &&
                defined(region._ref) &&
                region._ref in $filterRegionIds
              ]._id
            ) &&
   (
  $qPattern == null ||
  lower(title) match $qPattern ||
  lower(country->title) match $qPattern
)

          ] | order(datejoined desc, _createdAt desc)[$start...$end]{
            _id, title, datejoined, description, website,
            "countryTitle": country->title,
            "regionTitle": country->region->title
          }
      ),

      // matching current filters (+ search)
      "total": count(*[
        _type == "post" &&
        lower(status) == "published" &&
        (
          $filterRegionIds == null ||
          country._ref in *[
            _type == "country" &&
            defined(region._ref) &&
            region._ref in $filterRegionIds
          ]._id
        ) &&
(
  $qPattern == null ||
  lower(title) match $qPattern ||
  lower(country->title) match $qPattern
)

      ]),

      // all published, regardless of filters/search
      "publishedTotal": count(*[
        _type == "post" &&
        lower(status) == "published"
      ])
    }`,
    { filterRegionIds, start, end, sort, qPattern }
  )

  const shownFrom = total === 0 ? 0 : start + 1
  const shownTo = start + items.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageHref = (p: number) => buildHrefWithParams({ ...sp, page: p > 1 ? String(p) : undefined })

  return (
    <>
      {/* Hero + right column content you had */}
      <div className="post-two-col">
        <div className="post-main">
          <div className="hesiBanner">
            <div className="hesiBanner__overlay" aria-hidden="true" />
            <div className="hesiBanner__inner">
              <div className="hesiBanner__container container">
                <div className="hesiBanner__eyebrow">The HESI Community</div>
                <div className="hesiBanner__title">
                  The HESI community consists of UN entities, university networks,
                  student organizations, and higher education institutions committed to
                  advancing sustainable development
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="post-related">
          <img
            src="images/HESI-logo-horizontal.png"
            className="library_image"
            style={{ marginBottom: '10px', marginTop:'0px' }}
            alt="HESI"
          />
          HESI is chaired by the United Nations Department of Economic and Social Affairs (UN DESA), UN University,
          UNESCO International Institute for Higher Education in Latin America and the Caribbean (IESALC), and the
          Sulitest Association. Other UN partners include UNESCO, UN Environment Programme, UN Global Compact’s
          Principles for Responsible Management Education initiative, UN-HABITAT, UNCTAD, UNITAR, UN Office for
          Partnerships, and UN Academic Impact.
          <p></p>
          <p className="hesi-cta">
            <a
              href="https://sdgs.un.org/HESI"
              target="_blank"
              rel="noopener noreferrer"
              className="hesiLink"
            >
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
        {/* LEFT: counter, search, sort, regions */}
        <aside className="filters">
          {/* Results (matching current filters+search) */}
          <div className="results-bar results-bar--stack">
            <span className={`results-count${total === 0 ? ' is-zero' : ''}`}>{formatNumber(total)}</span>
            <span className="results-label">results</span>
          </div>

          {/* Title search */}
          <div className="filter_menu filter-menu--spaced"><strong>Search by title</strong>
          
          
           {q && (
              <Link className="reset-link" href={clearSearchHref(sp)} prefetch={false}>
                Clear
              </Link>
            )}
            
            </div>
          <form className="filter-search" method="get" action="/">
            {/* preserve regions + sort */}
            {selectedRegionIds.map((id) => (
              <input key={id} type="hidden" name="region" value={id} />
            ))}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <input
              className="filter-search__input"
              name="q"
              defaultValue={q}
              placeholder="Type a university name…"
              aria-label="Search members by title"
            />
            <button className="filter-search__button" type="submit">Search</button>
           
          </form>

          {/* Sort (segmented control) */}
          <div className="sort-group">
            <div className="filter_menu filter-menu--spaced"><strong>Sort by</strong></div>
            <nav className="segmented" role="radiogroup" aria-label="Sort by">
              <Link
                href={sortHref(sp, 'joined')}
                prefetch={false}
                className={`segmented__item ${sort === 'joined' ? 'is-active' : ''}`}
                role="radio"
                aria-checked={sort === 'joined'}
              >
                Joined (newest)
              </Link>
              <Link
                href={sortHref(sp, 'title')}
                prefetch={false}
                className={`segmented__item ${sort === 'title' ? 'is-active' : ''}`}
                role="radio"
                aria-checked={sort === 'title'}
              >
                Title (A–Z)
              </Link>
            </nav>
          </div>

          {/* Regions */}
          <div className="filter_menu filter-menu--spaced"><strong>Filter by region</strong></div>
          <div className="theme-filter">
            {CANON.map((r) => {
              const selected = selectedRegionIds.includes(r.id)
              return (
                <Link
                  key={r.id}
                  href={toggleRegionHref({ current: sp, id: r.id })}
                  className={`theme-chip-large ${selected ? 'is-selected' : ''}`}
                  role="button"
                  aria-pressed={selected}
                  title={r.title}
                  prefetch={false}
                >
                  {r.title}
                </Link>
              )
            })}
          </div>

          <div className="joinBox">
            <h5>Join HESI</h5>
            Any higher education institution or interested organization may join HESI.
            <p></p>
            <Link href="/join"><button className="theButton">Join & Engage</button></Link>
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
                <span className="btn-pager" aria-disabled="true">← Previous</span>
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
                    <span key={`e${idx}`} className="pagination__ellipsis">…</span>
                  ) : p === page ? (
                    <span key={p} className="pagination__link is-active" aria-current="page">{p}</span>
                  ) : (
                    <Link key={p} href={pageHref(p)} prefetch={false} className="pagination__link">{p}</Link>
                  )
                )
              })()}
            </nav>

            <div className="pager3__next">
              {shownTo < total ? (
                <Link href={pageHref(page + 1)} prefetch={false} className="btn-pager" aria-label="Next page">
                  Next →
                </Link>
              ) : (
                <span className="btn-pager" aria-disabled="true">Next →</span>
              )}
            </div>
          </div>

          <ul className="list-plain">
            {items.map((it) => (
              <li key={it._id} className="row-item">
                <details className="row-details">
                  <summary className="row-summary">
                    <div className="row-summary__title">{it.title}</div>
                    <div className="muted row-summary__meta">
                      {it.countryTitle ?? '—'}
                      {formatYear(it.datejoined) ? ` • ${formatYear(it.datejoined)}` : ''}
                    </div>
                  </summary>

                  <div className="row-details__body">
                    {it.description ? (
                      <p className="row-details__text">{it.description}</p>
                    ) : (
                      <p></p>
                    )}
                    {it.website && (
                      <p className="row-details__linkwrap">
                        <a className="webLink" href={it.website} target="_blank" rel="noopener noreferrer">
                          {it.website}
                        </a>
                      </p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>

          {/* BOTTOM PAGER */}
          <div className="pager3 pager3--bottom">
            <div className="pager3__prev">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} prefetch={false} className="btn-pager" aria-label="Previous page">
                  ← Previous
                </Link>
              ) : (
                <span className="btn-pager" aria-disabled="true">← Previous</span>
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
                    <span key={`e${idx}`} className="pagination__ellipsis">…</span>
                  ) : p === page ? (
                    <span key={p} className="pagination__link is-active" aria-current="page">{p}</span>
                  ) : (
                    <Link key={p} href={pageHref(p)} prefetch={false} className="pagination__link">{p}</Link>
                  )
                )
              })()}
            </nav>

            <div className="pager3__next">
              {shownTo < total ? (
                <Link href={pageHref(page + 1)} prefetch={false} className="btn-pager" aria-label="Next page">
                  Next →
                </Link>
              ) : (
                <span className="btn-pager" aria-disabled="true">Next →</span>
              )}
            </div>
          </div>

          {items.length === 0 && <p className="empty-state">No entries match these filters.</p>}
        </section>
      </div>
    </>
  )
}
