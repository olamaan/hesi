// src/components/ExistingMemberForm.tsx
'use client'

import { useState } from 'react'

type Match = { _id: string; title: string; countryTitle?: string }
type Area  = { _id: string; title: string }

export default function ExistingMemberForm() {
  const [email, setEmail] = useState('')
  const [loadingFind, setLoadingFind] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [matches, setMatches] = useState<Match[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [postId, setPostId] = useState<string>('')

  // areaId -> { checked, contribution, website }
  const [picked, setPicked] = useState<Record<string, { checked: boolean; contribution: string; website: string }>>({})

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ created: string[]; skipped: string[] } | null>(null)

  async function onFind() {
    setError(null)
    setLoadingFind(true)
    setMatches([])
    setAreas([])
    setPostId('')
    try {
      const res = await fetch(`/api/members/lookup?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Lookup failed')
      }
      setMatches(data.matches || [])
      setAreas(data.areas || [])
      // preselect when exactly one match
      if ((data.matches || []).length === 1) setPostId(data.matches[0]._id)
      // prime picked map (keep any text user typed if re-run)
      const nextPicked: typeof picked = { ...picked }
      for (const a of data.areas || []) {
        if (!nextPicked[a._id]) nextPicked[a._id] = { checked: false, contribution: '', website: '' }
      }
      setPicked(nextPicked)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setLoadingFind(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) { setError('Please enter your email.'); return }
    if (!postId) { setError('Please select your institution.'); return }

    // build selections
    const selections = Object.entries(picked)
      .filter(([, v]) => v.checked)
      .map(([areaId, v]) => ({
        areaId,
        contribution: v.contribution.trim(),
        website: v.website.trim() || undefined,
      }))

    if (selections.length === 0) { setError('Please pick at least one Priority Area.'); return }
    if (selections.some(s => s.contribution.length < 10)) {
      setError('Each selected Priority Area needs a short contribution (at least 10 characters).')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/priority/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, postId, selections }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Submit failed')
      }
      setSuccess({ created: data.created || [], skipped: data.skipped || [] })
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="alert">
        <p><strong>Thanks!</strong> Your Priority Area membership application has been submitted.</p>
        {success.created.length > 0 && <p>Created: {success.created.length} application(s).</p>}
        {success.skipped.length > 0 && (
          <p>Skipped (already applied): {success.skipped.length}.</p>
        )}
        <p>Our team will review and publish approved memberships.</p>
      </div>
    )
  }

  return (
    <form className="joinForm" onSubmit={onSubmit}>
      {error && (
        <div className="alert alert--warn">
          <strong>Heads up:</strong> {error}
        </div>
      )}

      {/* Step 1: locate institution by email */}
      <fieldset className="joinFieldset">
        <legend className="joinLegend">Find your institution</legend>

        <label className="joinLabel">
          <span className="joinLabel__text">Your email <span className="req">*</span></span>
          <input
            className="joinInput"
            type="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </label>

        <div className="joinActions">
          <button type="button" className="filter-search__button" onClick={onFind} disabled={loadingFind || !email}>
            {loadingFind ? 'Searching…' : 'Find my institution'}
          </button>
        </div>

        {matches.length === 0 && !loadingFind && email && (
          <p className="muted">No institution found for that email yet. You may need to use the email that’s listed on your member page, or <a href="/join">join as a new member</a>.</p>
        )}

        {matches.length > 0 && (
          <label className="joinLabel">
            <span className="joinLabel__text">Select your institution <span className="req">*</span></span>
            <select
              className="joinSelect"
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              required
            >
              <option value="">— Choose —</option>
              {matches.map(m => (
                <option key={m._id} value={m._id}>
                  {m.title}{m.countryTitle ? ` — ${m.countryTitle}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      {/* Step 2: choose Priority Areas and describe contribution */}
      <fieldset className="joinFieldset">
        <legend className="joinLegend">Priority Area memberships</legend>
        {areas.length === 0 ? (
          <p className="muted">Pick your institution first to continue.</p>
        ) : (
          <div className="paList">
            {areas.map(a => {
              const state = picked[a._id] || { checked: false, contribution: '', website: '' }
              return (
                <div key={a._id} className={`paItem ${state.checked ? 'is-active' : ''}`}>
                  <div className="paItem__head">
                    <input
                      id={`pa-${a._id}`}
                      type="checkbox"
                      checked={state.checked}
                      onChange={(e) => {
                        setPicked(prev => ({
                          ...prev,
                          [a._id]: { ...(prev[a._id] || { contribution: '', website: '' }), checked: e.target.checked }
                        }))
                      }}
                    />
                    <label className="paTitle" htmlFor={`pa-${a._id}`}>{a.title}</label>
                  </div>

                  {state.checked && (
                    <div className="paDetail">
                      <label className="joinLabel">
                        <span className="joinLabel__text">Contribution (what you’ll do)</span>
                        <textarea
                          className="joinTextarea"
                          rows={3}
                          value={state.contribution}
                          onChange={(e) =>
                            setPicked(prev => ({
                              ...prev,
                              [a._id]: { ...(prev[a._id] || { checked: true }), checked: true, contribution: e.target.value, website: state.website }
                            }))
                          }
                          placeholder="Briefly describe your planned contributions or activities for this Priority Area."
                        />
                      </label>

                      <label className="joinLabel">
                        <span className="joinLabel__text">Related link (optional)</span>
                        <input
                          className="joinInput"
                          type="url"
                          inputMode="url"
                          value={state.website}
                          onChange={(e) =>
                            setPicked(prev => ({
                              ...prev,
                              [a._id]: { ...(prev[a._id] || { checked: true }), checked: true, contribution: state.contribution, website: e.target.value }
                            }))
                          }
                          placeholder="https://example.org/your-program"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </fieldset>

      <div className="joinActions">
        <button className="returnButton" disabled={submitting || !postId}>
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
        <a href="/" className="joinCancel">Cancel</a>
      </div>
    </form>
  )
}
