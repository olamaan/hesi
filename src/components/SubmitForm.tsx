'use client'

import React from 'react'
import Link from 'next/link'

type Area = { _id: string; title: string; slug?: string | { current?: string } }
type Country = { _id: string; title: string }

function areaKey(a: Area) {
  return (typeof a.slug === 'string' && a.slug) ||
         (typeof a.slug === 'object' && a.slug?.current) ||
         a._id
}
function areaSlugValue(a: Area) {
  return (typeof a.slug === 'string' && a.slug) ||
         (typeof a.slug === 'object' && a.slug?.current) ||
         a._id
}

export default function SubmitForm({
  areas,
  countries,
}: {
  areas: Area[]
  countries: Country[]
}) {
  const [pending, setPending] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successId, setSuccessId] = React.useState<string | null>(null)

  // per-area selection state for styling & enabling textarea
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  function toggleArea(k: string, on: boolean) {
    setSelected((s) => ({ ...s, [k]: on }))
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setErrorMsg(null)
    setPending(true)

    try {
      const fd = new FormData(ev.currentTarget)

      // minimal client-side validation
      const title = String(fd.get('title') || '').trim()
      const email = String(fd.get('email') || '').trim()
      const countryId = String(fd.get('country') || '').trim()
      if (!title || !email || !countryId) {
        setErrorMsg('Please fill the required fields (Institution name, Contact email, Country).')
        setPending(false)
        return
      }

      // NOTE: We now POST the FormData directly — no JSON, no headers.
      // Your API route (`/api/submit`) that uses request.formData() will accept this.
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        // try to surface server error text
        const text = await res.text()
        throw new Error(text || `Request failed (${res.status})`)
      }
      const json = await res.json().catch(() => null)
      setSuccessId((json && json.id) || 'ok')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Submission failed.')
    } finally {
      setPending(false)
    }
  }

  if (successId) {
    return (
      <div className="alert" role="status" aria-live="polite">
        <p><strong>Thank you!</strong> Your membership request has been submitted.</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Your reference ID is <code>{successId}</code>. We’ll review your submission and published it as soon as possible.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/" className="hesiLink">Back to the HESI Community</Link>
        </p>
      </div>
    )
  }

  return (
    <form className="joinForm" onSubmit={onSubmit} action="/api/submit" method="POST" noValidate>
      {errorMsg && (
        <div className="alert alert--warn" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Institution */}
      <fieldset className="joinFieldset">
        <legend className="joinLegend">Organization</legend>

        <label className="joinLabel" htmlFor="title">
          <span className="joinLabel__text">
            Institution name <span className="req" aria-hidden>*</span>
          </span>
          <input id="title" name="title" className="joinInput" required />
        </label>

        <label className="joinLabel" htmlFor="countryId">
          <span className="joinLabel__text">
            Country <span className="req" aria-hidden>*</span>
          </span>
<select name="country" className="joinSelect" defaultValue="">
  <option value="" disabled>Select country…</option>
  {countries.map((c) => (
    <option key={c._id} value={c._id}>{c.title}</option>
  ))}
</select>


        </label>

        <label className="joinLabel" htmlFor="website">
          <span className="joinLabel__text">Website</span>
          <input id="website" name="website" className="joinInput" placeholder="https://…" />
        </label>

        <label className="joinLabel" htmlFor="email">
          <span className="joinLabel__text">
            Contact email(s) <span className="req" aria-hidden>*</span>
          </span>
          <input
            id="email"
            name="email"
            className="joinInput"
            placeholder="name@example.org (comma/space separated for multiple)"
            required
          />
        </label>

        <label className="joinLabel" htmlFor="email">
          <span className="joinLabel__text">
            Focal point (name) <span className="req" aria-hidden>*</span>
          </span>
          <input
            id="focalpoint"
            name="focalpoint"
            className="joinInput"
            placeholder="Name of main contact person"
            required
          />
        </label>


        <label className="joinLabel" htmlFor="description">
          <span className="joinLabel__text">Short description</span>
          <textarea id="description" name="description" className="joinTextarea" rows={4} />
        </label>
      </fieldset>

      {/* Priority areas */}

{/* Priority area memberships 
<fieldset className="joinFieldset">
  <legend className="joinLegend">Priority area memberships (optional)</legend>

  <div className="paList">
    {areas.map((a) => {
      const isChecked = !!selected[a._id]
      return (
        <div key={a._id} className={`paItem ${isChecked ? 'is-active' : ''}`}>
          <label className="paItem__head">
            <input
              type="checkbox"
              name="priorityAreas"
              value={a._id}                 // <-- send ID
              checked={isChecked}
              onChange={(e) => {
                const checked = e.currentTarget.checked
                setSelected((prev) => ({ ...prev, [a._id]: checked }))
              }}
            />
            <span className="paTitle">{a.title}</span>
          </label>

          {isChecked && (
            <div className="paDetail">
              <label className="joinLabel">
                <span className="joinLabel__text">Your contribution</span>
                <textarea
                  name={`contrib.${a._id}`}  // <-- key by ID
                  className="joinTextarea"
                  rows={3}
                  defaultValue=""
                />
              </label>
            </div>
          )}
        </div>
      )
    })}
  </div>
</fieldset>
*/}


      <div className="joinActions">
        <button className="returnButton" type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit'}
        </button>
        
      </div>
    </form>
  )
}
