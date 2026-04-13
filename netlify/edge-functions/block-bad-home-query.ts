// netlify/edge-functions/block-bad-home-query.ts

export default async (request: Request) => {
  const url = new URL(request.url)

  if (url.pathname !== '/') {
    return
  }

  const rawSearch = url.search || ''
  const lowerSearch = rawSearch.toLowerCase()
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase()

  const hasBlockedQuery =
    lowerSearch.includes('region=') ||
    lowerSearch.includes('%c2%aeion%3d') ||
    lowerSearch.includes('®ion=')

  // Optional: keep this false unless you want to block this crawler entirely
  const blockMetaCrawler = false
  const isMetaCrawler =
    userAgent.includes('meta-externalagent') ||
    userAgent.includes('facebookexternalhit')

  if (hasBlockedQuery || (blockMetaCrawler && isMetaCrawler)) {
    return new Response('Forbidden', {
      status: 403,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    })
  }

  return
}

export const config = {
  path: '/',
}