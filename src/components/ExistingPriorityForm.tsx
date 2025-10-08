'use client'

import { useEffect, useMemo, useState } from 'react'

type Area = { _id: string; title: string; description?: string }
type Existing = { _id: string; areaId: string; contribution?: string; since?: string; website?: string; status?: string }

export default function ExistingPriorityForm({ postIdOrToken }: { postIdOrToken: string }) {
  const [loading, setLoading] = useState(true)
  const [areas, setAreas] = useState<Area[]>([])
  const [existing, setExisting] = useState<Existing[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // form state
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [detail, setDetail] = useState<Record<string, { contribution: string; since: string; website: string; membershipId?: string }>>({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const qs = new URLSearchParams()
        // Dev: token == postId for now; support both
        if (postIdOrToken.startsWith('post-') || postIdOrToken.startsWith('drafts.')) {
          qs.set('postId', postIdOrToken)
        } else {
          qs.set('token', postIdOrToken)
        }
        const res = await fetch(`/api/existing/priority/prefill?${qs.toString()}`, { cache: 'no-store' })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Prefill failed')

        if (!mounted) return
        setAreas(json.areas || [])
        setExisting(json.existing || [])

        // Preselect + preload fields
        const nextSel: Record<string, boolean> = {}
        const nextDet: Record<string, any> = {}
        for (const m of json.existing || []) {
          nextSel[m.areaId] = true
          nextDet[m.areaId] = {
            contribution: m.contribution || '',
            since: m.since || '',
            website: m.website || '',
            membershipId: m._id,
          }
        }
        setSelected(nextSel)
        setDetail(nextDet)
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed to load')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [postIdOrToken])

  const anySelected = useMemo(() => Object.values(selected).some(Boolean), [selected])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setOkMsg(null)
    setError(null)
    try {
      const selections = Object.keys(selected)
        .filter((areaId) => selected[areaId])
        .map((areaId) => {
          const d = detail[areaId] || { contribution: '', since: '', website: '' }
          return {
            areaId,
            contribution: d.contribution.trim(),
            since: d.since || null,
            website: d.website || null,
            membershipId: d.membershipId || null,
          }
        })

      if (selections.length === 0) {
        setError('Please choose at least one Priority Area.')
        setBusy(false)
        return
      }

      const body = {
        ...(postIdOrToken.startsWith('post-') ? { postId: postIdOrToken } : { token: postIdOrToken }),
        selections,
      }

      const res = await fetch('/api/existing/priority/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Submit failed')

      setOkMsg('Your Priority Area memberships were saved. Thank you!')
    } catch (e: any) {
      setError(e.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>Loading…</p>
  if (error)   return <p className="alert alert--warn">{error}</p>

  return (
    <form className="joinForm" onSubmit={onSubmit}>
      {okMsg && <div className="alert">{okMsg}</div>}

      <fieldset className="joinFieldset">
        <legend className="joinLegend">Priority Areas</legend>

        <div className="paList">
          {areas.map((a) => {
            const isOn = !!selected[a._id]
            const d = detail[a._id] || { contribution: '', since: '', website: '' }
            return (
              <div key={a._id} className={`paItem${isOn ? ' is-active' : ''}`}>
                <div className="paItem__head">
                  <input
                    id={`pa-${a._id}`}
                    type="checkbox"
                    checked={isOn}
                    onChange={(ev) => {
                      const on = ev.target.checked
                      setSelected((s) => ({ ...s, [a._id]: on }))
                      if (on && !detail[a._id]) {
                        setDetail((s) => ({ ...s, [a._id]: { contribution: '', since: '', website: '' } }))
                      }
                    }}
                  />
                  <label htmlFor={`pa-${a._id}`} className="paTitle">{a.title}</label>
                </div>

                {isOn && (
                  <div className="paDetail">
                    <label className="joinLabel">
                      <span className="joinLabel__text">Your contribution <span className="req">*</span></span>
                      <textarea
                        className="joinTextarea"
                        required
                        value={d.contribution}
                        onChange={(e) => setDetail((s) => ({ ...s, [a._id]: { ...d, contribution: e.target.value } }))}
                      />
                    </label>

                    <label className="joinLabel">
                      <span className="joinLabel__text">Member since (YYYY-MM-DD)</span>
                      <input
                        className="joinInput"
                        type="date"
                        value={d.since || ''}
                        onChange={(e) => setDetail((s) => ({ ...s, [a._id]: { ...d, since: e.target.value } }))}
                      />
                    </label>

                    <label className="joinLabel">
                      <span className="joinLabel__text">Related link</span>
                      <input
                        className="joinInput"
                        type="url"
                        placeholder="https://example.org/…"
                        value={d.website || ''}
                        onChange={(e) => setDetail((s) => ({ ...s, [a._id]: { ...d, website: e.target.value } }))}
                      />
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>

      {!anySelected && <div className="alert alert--warn">Choose at least one Priority Area to continue.</div>}

      <div className="joinActions">
        <button className="returnButton" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save memberships'}</button>
      </div>
    </form>
  )
}
