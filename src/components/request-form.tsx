'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

const choices = [
  'Lawn care', 'Yard & garden', 'Snow clearing', 'Help around the home', 'Something else',
] as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function RequestForm({ initialService = '' }: { initialService?: string }) {
  const selected = choices.includes(initialService as typeof choices[number]) ? initialService : '';
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus('sending');
    setError('');
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'The request could not be sent.');
      setReference(result.id.slice(0, 8).toUpperCase());
      form.reset();
      setStatus('sent');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request could not be sent. Please call us instead.');
      setStatus('error');
    }
  }

  return <section className="request-section" id="request" aria-labelledby="request-title"><div className="container request-grid">
    <div className="request-intro"><p className="eyebrow">Get in touch</p><h2 id="request-title">Tell us about the job.</h2><p>A sentence or two is enough to get started. We’ll look it over and get back to you. We’ll discuss the cost and timing before making an appointment.</p><div className="call-card"><strong>Would you rather talk?</strong><a href="tel:+17706302094">Call 770-630-2094</a><a href="sms:+17706302094">Or send a text</a></div></div>
    <div className="form-shell">
      {status === 'sent' ? <div className="form-success" role="status"><span className="success-mark" aria-hidden="true">✓</span><h3>Your request was sent.</h3><p>We’ll review it and reach you at the number you provided. Keep reference <strong>{reference}</strong> if you need to follow up.</p><p>Sending a request does not book a visit.</p><button className="button button-outline" type="button" onClick={() => setStatus('idle')}>Send another request</button></div> :
      <form onSubmit={submit} aria-label="Service request" noValidate={false}>
        <div className="form-field"><label htmlFor="service">What can we help with? <span aria-hidden="true">*</span></label><select id="service" name="service" defaultValue={selected} required><option value="" disabled>Choose the closest match</option>{choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select></div>
        <div className="form-field"><label htmlFor="description">A little about the job <span aria-hidden="true">*</span></label><textarea id="description" name="description" rows={4} minLength={10} maxLength={3000} required placeholder="For example, I'd like the weeds pulled from two garden beds." /></div>
        <div className="form-pair"><div className="form-field"><label htmlFor="name">Your name <span aria-hidden="true">*</span></label><input id="name" name="name" autoComplete="name" maxLength={120} required /></div><div className="form-field"><label htmlFor="phone">Phone number <span aria-hidden="true">*</span></label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={35} required /></div></div>
        <div className="form-field"><label htmlFor="email">Email <span className="optional">optional</span></label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} /></div>
        <div className="form-pair"><div className="form-field"><label htmlFor="street">Street address <span aria-hidden="true">*</span></label><input id="street" name="street" autoComplete="street-address" maxLength={200} required /></div><div className="form-field"><label htmlFor="city">City <span aria-hidden="true">*</span></label><select id="city" name="city" defaultValue="" required><option value="" disabled>Choose city</option><option>DeKalb</option><option>Sycamore</option><option>Cortland</option></select></div></div>
        <div className="form-field"><label htmlFor="preferredTime">When is usually good for you? <span className="optional">optional</span></label><input id="preferredTime" name="preferredTime" maxLength={180} placeholder="Weekday afternoons, next week, etc." /><p className="field-help">This helps us call you back. It does not book a time.</p></div>
        <div className="form-field"><label htmlFor="communityRate">Would you like to ask about the Community Rate? <span className="optional">optional</span></label><select id="communityRate" name="communityRate" defaultValue="No"><option>No</option><option>Yes</option></select><p className="field-help">For seniors 70+, veterans, single moms, and people with disabilities. No proof is needed.</p></div>
        <div className="hp-field" aria-hidden="true"><label htmlFor="website">Leave this blank</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
        {status === 'error' && <p className="form-error" role="alert">{error} <a href="tel:+17706302094">Call 770-630-2094</a>.</p>}
        <button className="button button-primary form-submit" type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send my request'}</button>
        <p className="form-fineprint">Please leave out door codes, payment details, and medical information. By sending this, you agree we may contact you about your request. <Link href="/privacy">Privacy</Link> · <Link href="/terms">Website terms</Link></p>
      </form>}
    </div>
  </div></section>;
}
