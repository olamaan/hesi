// src/components/HomeHero.tsx
import Link from 'next/link'
import { publicClient as client } from '@/sanity/lib/client'

type BadgeType = 'forum' | 'network' | 'cop' | 'action'

export function Badge({
  type,
  className = '',
  title,
}: {
  type: BadgeType
  className?: string
  title?: string
}) {
  return (
    <span
      className={`badge-circle badge--${type} ${className}`}
      title={title}
      aria-label={title}
    />
  )
}

// SDG colors (currently unused but kept in case you hook into them later)
const SDG = {
  forum: '#19486A',
  network: '#F36D25',
  cop: '#C5192D',
  action: '#3F7E44',
} as const

/** Six canonical regions */
const CANON = [
  { id: 'region.africa', title: 'Africa' },
  { id: 'region.asia-pacific', title: 'Asia-Pacific' },
  { id: 'region.europe', title: 'Europe' },
  { id: 'region.lac', title: 'Latin America and the Caribbean' },
  { id: 'region.north-america', title: 'North America' },
  { id: 'region.western-asia', title: 'Western Asia' },
]

const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n)

type ActivityType = 'forum' | 'network' | 'cop' | 'action' | 'other'

type Item = {
  _id: string
  title: string
  slug?: string
  website?: string
  datejoined?: string
  countryTitle?: string
  regionTitle?: string
  hasForum?: boolean
  hasNetwork?: boolean
  hasCop?: boolean
  hasAction?: boolean
  activities?: { _id: string; type: ActivityType; title?: string }[]
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
  return buildHrefWithParams({ ...current, region: next.length ? next : undefined, page: undefined })
}

// set sort & reset page
function sortHref(current: { [k: string]: string | string[] | undefined }, sort: 'joined' | 'title') {
  return buildHrefWithParams({ ...current, sort, page: undefined })
}

// clear search & reset page
function clearSearchHref(current: { [k: string]: string | string[] | undefined }) {
  return buildHrefWithParams({ ...current, q: undefined, page: undefined })
}

export default async function HomeHero({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const sp = searchParams ?? {}

  // title/country search (q)
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
  const perPage = 12
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
            _id, title, datejoined, website,
            "slug": slug.current,
            "countryTitle": country->title,
            "regionTitle": country->region->title,

            "hasForum":   count(coalesce(forums[], [])) > 0,
            "hasNetwork": count(coalesce(networks[], [])) > 0,
            "hasCop":     count(coalesce(priorityAreas[], [])) > 0,
            "hasAction":  count(coalesce(actionGroups[], [])) > 0,

            "activities": [
              ...select(defined(forums)         => forums[]->         {_id, "type":"forum",   title}),
              ...select(defined(networks)       => networks[]->       {_id, "type":"network", title}),
              ...select(defined(priorityAreas)  => priorityAreas[]->  {_id, "type":"cop",     title}),
              ...select(defined(actionGroups)   => actionGroups[]->   {_id, "type":"action",  title})
            ]
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
          _id, title, datejoined, website,
          "slug": slug.current,
          "countryTitle": country->title,
          "regionTitle": country->region->title,

          "hasForum":   count(coalesce(forums[], [])) > 0,
          "hasNetwork": count(coalesce(networks[], [])) > 0,
          "hasCop":     count(coalesce(priorityAreas[], [])) > 0,
          "hasAction":  count(coalesce(actionGroups[], [])) > 0,

          "activities": [
            ...select(defined(forums)         => forums[]->         {_id, "type":"forum",   title}),
            ...select(defined(networks)       => networks[]->       {_id, "type":"network", title}),
            ...select(defined(priorityAreas)  => priorityAreas[]->  {_id, "type":"cop",     title}),
            ...select(defined(actionGroups)   => actionGroups[]->   {_id, "type":"action",  title})
          ]
        }
      ),

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

      "publishedTotal": count(*[
        _type == "post" &&
        lower(status) == "published"
      ])
    }`,
    { filterRegionIds, start, end, sort, qPattern },
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
        {/* LEFT: counter, search, sort, regions */}
        <aside className="filters">
          <div className="results-bar results-bar--stack">
            <span className={`results-count${total === 0 ? ' is-zero' : ''}`}>{formatNumber(total)}</span>
            <span className="results-label">results</span>
          </div>

          {/* Sort (segmented control) */}
          <div className="sort-group">
            <div className="filter_menu filter-menu--spaced">
              <strong>Sort by</strong>
            </div>
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

          {/* Title/Country search */}
          <div className="filter_menu filter-menu--spaced" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong>Search by Org &amp; country</strong>
            {q && (
              <Link className="reset-link" href={clearSearchHref(sp)} prefetch={false}>
                Clear
              </Link>
            )}
          </div>
          <form className="filter-search" method="get" action="/">
            {selectedRegionIds.map((id) => (
              <input key={id} type="hidden" name="region" value={id} />
            ))}
            {sort && <input type="hidden" name="sort" value={sort} />}
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

          {/* Regions */}
          <div className="filter_menu filter-menu--spaced">
            <strong>Filter by region</strong>
          </div>
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
            <div className="row-summary__title">
      
                {it.title}
        
            </div>

              
                      </div>

                      {(() => {
                        const hasAll = !!(it.hasForum && it.hasNetwork && it.hasCop && it.hasAction)
                        return (
                          <div
                            className={`row-summary__badges${hasAll ? ' is-all' : ''}`}
                            role="group"
                            aria-label="Membership badges"
                          >
                            {it.hasForum && <span className="badge-circle badge--forum" title="Forum participant" aria-label="Forum participant" />}
                            {it.hasNetwork && (
                              <span className="badge-circle badge--network" title="Network participant" aria-label="Network participant" />
                            )}
                            {it.hasCop && (
                              <span className="badge-circle badge--cop" title="Community of Practice member" aria-label="Community of Practice member" />
                            )}
                            {it.hasAction && <span className="badge-circle badge--action" title="Action Group member" aria-label="Action Group member" />}
                          </div>
                        )
                      })()}
                    </summary>

                    <div className="row-details__body">
                      {/* Meta line: country | year | website */}
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

                      {/* Description removed from listing */}

                      {/* Grouped activities */}
                      {(it.activities && it.activities.length > 0) &&
                        (() => {
                          const uniq = (xs: (string | undefined)[]) => Array.from(new Set(xs.filter(Boolean))) as string[]

                          const forums = uniq(it.activities.filter((a) => a.type === 'forum').map((a) => a.title))
                          const networks = uniq(it.activities.filter((a) => a.type === 'network').map((a) => a.title))
                          const cops = uniq(it.activities.filter((a) => a.type === 'cop').map((a) => a.title))
                          const actions = uniq(it.activities.filter((a) => a.type === 'action').map((a) => a.title))

                          const hasAny = forums.length || networks.length || cops.length || actions.length
                          if (!hasAny) return null

                          const Line = ({
                            type,
                            label,
                            items,
                          }: {
                            type: 'forum' | 'network' | 'cop' | 'action'
                            label: string
                            items: string[]
                          }) =>
                            items.length ? (
                              <div className="row-activities__line">
                                <Badge type={type} className="row-activities__badge" title={label} />
                                <span className="row-activities__type">{label}:</span>{' '}
                                <span className="row-activities__titles">{items.join(', ')}</span>
                              </div>
                            ) : null

                          return (
                            <div className="row-activities">
                              <div className="row-activities__label">Active in:</div>
                              <Line type="forum" label="Forum" items={forums} />
                              <Line type="network" label="Network" items={networks} />
                              <Line type="cop" label="Community of Practice" items={cops} />
                              <Line type="action" label="Action Group" items={actions} />
                            </div>
                          )
                        })()}

                      {detailsHref ? (
                        <div style={{ marginTop: 12 }}>
                          <Link href={detailsHref} prefetch={false} className="btn-pager">
                            View full profile →
                          </Link>
                        </div>
                      ) : null}
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
