// src/components/PriorityApplyForm.tsx
'use client'

import { useState } from 'react'

type Area = { _id: string; title: string }
export default function PriorityApplyForm({ postId, email, areas }: { postId: string; email: string; areas: Area[] }) {
  const [picked, setPicked] = useState<Record<string, { checked: boolean; contribution: string; website: string }>>(
    Object.fromEntries(areas.map(a => [a._id, { checked: false, contribution: '', website: '' }]))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ created: string[]; skipped: string[] } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const selections = Object.entries(picked)
      .filter(([, v]) => v.checked)
      .map(([areaId, v]) => ({ areaId, contribution: v.contribution.trim(), website: v.website.trim() || undefined }))

    if (selections.length === 0) return setError('Please select at least one Priority Area.')
    if (selections.some(s => s.contribution.length < 10)) return setError('Each selected Priority Area needs a short contribution (≥10 chars).')

    try {
      setSubmitting(true)
      const res = await fetch('/api/priority/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, email, selections }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Submit failed')
      setDone({ created: data.created || [], skipped: data.skipped || [] })
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="alert">
        <p><strong>Thanks!</strong> Your application has been submitted.</p>
        {done.created.length > 0 && <p>Created: {done.created.length} application(s).</p>}
        {done.skipped.length > 0 && <p>Skipped (already applied): {done.skipped.length}.</p>}
      </div>
    )
  }

  return (
    <form className="joinForm" onSubmit={onSubmit}>
      {error && <div className="alert alert--warn">{error}</div>}

      <fieldset className="joinFieldset">
        <legend className="joinLegend">Priority Area memberships</legend>
        <div className="paList">
          {areas.map(a => {
            const st = picked[a._id]
            return (
              <div key={a._id} className={`paItem ${st?.checked ? 'is-active' : ''}`}>
                <div className="paItem__head">
                  <input
                    id={`pa-${a._id}`}
                    type="checkbox"
                    checked={!!st?.checked}
                    onChange={(e) => setPicked(prev => ({
                      ...prev,
                      [a._id]: { ...(prev[a._id] || { contribution: '', website: '' }), checked: e.target.checked }
                    }))}
                  />
                  <label className="paTitle" htmlFor={`pa-${a._id}`}>{a.title}</label>
                </div>

                {!!st?.checked && (
                  <div className="paDetail">
                    <label className="joinLabel">
                      <span className="joinLabel__text">Contribution</span>
                      <textarea
                        className="joinTextarea"
                        rows={3}
                        value={st.contribution}
                        onChange={(e) => setPicked(prev => ({
                          ...prev,
                          [a._id]: { ...(prev[a._id] || { checked: true }), checked: true, contribution: e.target.value, website: st.website }
                        }))}
                      />
                    </label>

                    <label className="joinLabel">
                      <span className="joinLabel__text">Related link (optional)</span>
                      <input
                        className="joinInput"
                        type="url"
                        value={st.website}
                        onChange={(e) => setPicked(prev => ({
                          ...prev,
                          [a._id]: { ...(prev[a._id] || { checked: true }), checked: true, contribution: st.contribution, website: e.target.value }
                        }))}
                        placeholder="https://example.org"
                      />
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="joinActions">
        <button className="returnButton" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</button>
        
      </div>
    </form>
  )
}
