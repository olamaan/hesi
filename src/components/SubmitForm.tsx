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

  const title = String(fd.get('title') || '').trim()
  const email = String(fd.get('email') || '').trim()
  const countryId = String(fd.get('country') || '').trim()
  const description = String(fd.get('description') || '').trim()
  const website = String(fd.get('website') || '').trim()


  if (!title || !email || !countryId || !description || !website) {
    setErrorMsg('Please fill the required fields (Institution name, Contact email, Country, Description, Website).')
    setPending(false)
    return
  }

  const res = await fetch('/api/submit', { method: 'POST', body: fd })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  const json = await res.json().catch(() => null)
  setSuccessId((json && json.id) || 'ok')
} catch (err: unknown) {
  const msg =
    err instanceof Error ? err.message :
    typeof err === 'string' ? err :
    'Submission failed.'
  setErrorMsg(msg)
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
 
 
 <div className="joinBox">
<h2>About HESI Membership</h2>

 
 
<p>The Higher Education Sustainability Initiative (HESI), launched in the lead-up to the Rio+20 Conference in 2012 as an open partnership between several United Nations entities and the higher education community, aims to enhance the role of the higher education sector in advancing sustainable development by facilitating multi-stakeholder discussions, actions, and the dissemination of best practices.</p> 




<p>By joining HESI, your institution becomes part of a global community working collaboratively to advance sustainability in higher education and beyond. Members are encouraged to actively contribute to this shared mission by:
</p>
 

<ul className='library_list'>
<li>Integrating sustainable development into teaching, research, campus operations, and institutional strategies to equip students and future leaders with the knowledge and skills to advance the SDGs.</li>
<li>Promoting sustainability-focused research and innovation that supports evidence-based policymaking and solutions to global challenges.</li>
<li>Fostering partnerships and collaboration with peers and stakeholders to strengthen the role of academia in building sustainable and inclusive communities.</li>
<li>Sharing good practices and progress updates that showcase how your institution contributes to the 2030 Agenda and inspires others in the higher education community.</li>
</ul>

 


<p>
  As a member, you are encouraged to engage in HESI activities and initiatives that align with your institution’s priorities and capacities. These include participating in the annual HESI Networking Forum, the HESI Global Forum, the HESI Action Groups, and the communities of practice under the three priority areas of the HESI Partnership Framework:
</p>
<ul className='library_list'>
  <li>Teaching and Learning</li>
  <li>Research and Innovation</li>
  <li>Partnerships and Engagement</li>
</ul>
<p>
  Membership is free of charge and open to all higher education institutions, entities with a mandate to work in higher education, and affiliated partners that work with higher education stakeholders.
</p>

<p>Your participation in HESI reflects a commitment to integrating sustainability into higher education and supporting global collaboration for the Sustainable Development Goals. We look forward to your active engagement in this shared effort.</p>

</div>

 <div  aria-live="rude">
<h2>Notes</h2>

Please note that membership in HESI is institutional and not open to individuals. By submitting this form, you are applying for your institution to become a member of HESI.
 </div>

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
          <span className="joinLabel__text">Website <span className="req" aria-hidden>*</span></span>
          <input id="website" name="website" className="joinInput" placeholder="https://…" />
        </label>

        <label className="joinLabel" htmlFor="email">
          <span className="joinLabel__text">
            Contact email(s) <span className="req" aria-hidden>*</span>
          </span>

          Should match institutional website.
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
          <span className="joinLabel__text">Explain what your institution is doing to promote higher education for sustainable development.<span className="req" aria-hidden>*</span></span>
          <textarea id="description" name="description" className="joinTextarea" rows={8} />
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

  {errorMsg && (
        <div className="alert alert--warn" role="alert">
          {errorMsg}
        </div>
      )}

<p>By submitting this form, you consent to the HESI Secretariat and the United Nations Department of Economic and Social Affairs (UN DESA) publishing relevant information about your institution (excluding personal contact details such as email addresses) on the HESI Community platform, and to receiving the HESI monthly newsletter and other relevant updates.</p>

      <div className="joinActions">
        <button className="theButton" type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit'}
        </button>
        
      </div>
    </form>
  )
}
