// src/app/(site)/join/existing/page.tsx
'use client'

// src/app/(site)/join/existing/page.tsx
import { redirect } from 'next/navigation'

 
redirect('/join') // temporarily disabled
 


import { useEffect, useState } from 'react'

type Match = { _id: string; title: string; countryTitle?: string }

export default function ExistingMemberStart() {
  const [q, setQ] = useState('')
  const [email, setEmail] = useState('')
  const [results, setResults] = useState<Match[]>([])
  const [postId, setPostId] = useState('')
  const [loading, setLoading] = useState(false)     // sending link
  const [searching, setSearching] = useState(false) // live search
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ previewUrl?: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      setError(null)
      const term = q.trim()
      if (!term) {
        setResults([])
        setSearching(false)
        return
      }
      try {
        setSearching(true)
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(term)}`)
        const data = await res.json()
        setResults(data.matches || [])
      } catch {
        setError('Search failed')
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!postId) return setError('Select your institution.')
    if (!email)  return setError('Enter your email.')
    try {
      setLoading(true)
      const res = await fetch('/api/priority/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, email }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to send link')
      setSent({ previewUrl: data.previewUrl })
    } catch (e: any) {
      setError(e?.message || 'Failed to send link')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="alert">
        <p><strong>Check your email!</strong> We sent you a sign-in link to apply for Priority Area membership.</p>
        {sent.previewUrl && (
          <p className="muted">Dev preview: <a href={sent.previewUrl}>Open form</a></p>
        )}
      </div>
    )
  }

  const showNotFound = q.trim().length > 0 && !searching && results.length === 0

  return (
    <section>
      <h2>Existing members — request a link</h2>
      <form className="joinForm" onSubmit={onSend}>
        {error && <div className="alert alert--warn">{error}</div>}

        <fieldset className="joinFieldset">
          <legend className="joinLegend">Your institution</legend>

          <label className="joinLabel">
            <span className="joinLabel__text">Type your institution name</span>
            <input
              className="joinInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Start typing…"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-busy={searching}
            />
          </label>

          {searching && <div className="muted">Searching…</div>}

          {showNotFound && (
            <div className="alert alert--warn">
              Your organization/institution was not found. Please try again.
            </div>
          )}

          {results.length > 0 && (
            <label className="joinLabel">
              <span className="joinLabel__text">Select from results</span>
              <select
                className="joinSelect"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
              >
                <option value="">— Choose —</option>
                {results.map(r => (
                  <option key={r._id} value={r._id}>
                    {r.title}{r.countryTitle ? ` — ${r.countryTitle}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        <fieldset className="joinFieldset">
          <legend className="joinLegend">Your email</legend>
          <label className="joinLabel">
            <span className="joinLabel__text">Email on record for this institution</span>
            <input
              className="joinInput"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
            />
          </label>
          <p className="muted">Must match one of the emails listed on the member profile.</p>
        </fieldset>

        <div className="joinActions">
          <button className="returnButton" disabled={loading || !postId || !email}>
            {loading ? 'Sending…' : 'Email me a link'}
          </button>
          <a className="joinCancel" href="/">Cancel</a>
        </div>
      </form>
    </section>
  )
}
