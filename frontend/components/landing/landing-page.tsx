'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CredentisLogo } from '@/components/logo';

function ShieldCheckIcon({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none">
      <path d="M9 2L3 5V9.5C3 12.9 5.7 16.1 9 17C12.3 16.1 15 12.9 15 9.5V5L9 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.5 9L8.2 10.8L11.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className = 'text-green-500' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <button
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-[family-name:var(--font-bricolage)] font-semibold text-slate-900 text-sm">{question}</span>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`faq-answer px-6 text-slate-500 text-sm leading-relaxed ${open ? 'open' : ''}`}>
        <div className="pb-5">{answer}</div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      navRef.current?.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-white text-slate-800 antialiased font-[family-name:var(--font-dm-sans)]">
      {/* NAV */}
      <header ref={navRef} className="landing-nav fixed inset-x-0 top-0 z-50 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <CredentisLogo className="w-8 h-8" />
            <span className="font-[family-name:var(--font-bricolage)] font-bold text-lg tracking-tight text-slate-900">Credentis</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600 font-medium">
            <button onClick={() => scrollTo('features')} className="hover:text-primary-600 transition-colors">Features</button>
            <button onClick={() => scrollTo('how-it-works')} className="hover:text-primary-600 transition-colors">How It Works</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-primary-600 transition-colors">Pricing</button>
            <button onClick={() => scrollTo('faq')} className="hover:text-primary-600 transition-colors">FAQ</button>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Sign In</Link>
            <Link href="/sign-in" className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M11 7L8 4M11 7L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero-grid pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <div className="max-w-3xl fade-up">
            <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-600 pulse-dot" />
              Compliance Infrastructure for Home Health
            </div>
            <h1 className="font-[family-name:var(--font-bricolage)] text-5xl sm:text-6xl font-extrabold leading-[1.08] tracking-tight text-slate-900 mb-6">
              Know exactly which<br />
              clinicians are<br />
              <span className="text-primary-600">ready to staff.</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-xl font-light">
              Credentis automates credential collection, tracks expiration dates, and gives your agency a single source of truth on clinician readiness — so compliance gaps don&apos;t become missed placements.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-in" className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-lg shadow-primary-600/20">
                Get Started
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9.5 4.5M13 8L9.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <button onClick={() => scrollTo('how-it-works')} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors">
                See How It Works
              </button>
            </div>
          </div>

          {/* Hero dashboard mockup */}
          <div className="mt-16 fade-up delay-3">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/80 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-white border border-slate-200 rounded-md px-3 py-1 text-xs text-slate-400 font-mono max-w-xs mx-auto text-center">app.credentis.com/dashboard</div>
                </div>
              </div>
              <div className="flex min-h-[420px]">
                {/* Sidebar */}
                <div className="w-52 border-r border-slate-100 bg-slate-50/50 p-4 hidden md:block">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-2">Agency</div>
                  <nav className="space-y-0.5 text-sm">
                    <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-primary-50 text-primary-700 font-medium">Dashboard</div>
                    <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-slate-500">Clinicians</div>
                    <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-slate-500">Checklists</div>
                    <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-slate-500">Expirations</div>
                    <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-slate-500">Audit Log</div>
                  </nav>
                  <div className="mt-6 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-2">Stats</div>
                  <div className="space-y-3 px-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">Ready to Staff</span><span className="text-green-600 font-semibold">42</span></div>
                      <div className="h-1.5 bg-slate-200 rounded-full"><div className="h-1.5 bg-green-500 rounded-full mock-bar" style={{ width: '70%' }} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">Pending Review</span><span className="text-amber-600 font-semibold">11</span></div>
                      <div className="h-1.5 bg-slate-200 rounded-full"><div className="h-1.5 bg-amber-400 rounded-full mock-bar" style={{ width: '18%' }} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">Not Compliant</span><span className="text-red-500 font-semibold">7</span></div>
                      <div className="h-1.5 bg-slate-200 rounded-full"><div className="h-1.5 bg-red-400 rounded-full mock-bar" style={{ width: '12%' }} /></div>
                    </div>
                  </div>
                </div>
                {/* Main content */}
                <div className="flex-1 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-[family-name:var(--font-bricolage)] font-bold text-slate-900 text-base">Clinician Roster</h3>
                      <p className="text-xs text-slate-400 mt-0.5">60 active clinicians</p>
                    </div>
                    <button className="inline-flex items-center gap-1.5 bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                      + Add Clinician
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Clinician</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Type</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-semibold hidden sm:table-cell">License Exp.</th>
                          <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { name: 'Sarah M.', type: 'PT', exp: 'Aug 12, 2026', status: 'Ready', color: 'green' },
                          { name: 'James K.', type: 'OT', exp: 'Mar 3, 2026', status: 'Pending', color: 'amber' },
                          { name: 'Linda R.', type: 'SLP', exp: 'Expired', status: 'Not Compliant', color: 'red' },
                          { name: 'Carlos V.', type: 'PTA', exp: 'Dec 1, 2026', status: 'Ready', color: 'green' },
                        ].map((row) => (
                          <tr key={row.name} className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                            <td className="px-4 py-3 text-slate-500">{row.type}</td>
                            <td className={`px-4 py-3 hidden sm:table-cell ${row.exp === 'Expired' ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>{row.exp}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 bg-${row.color}-50 text-${row.color}-700 px-2 py-0.5 rounded-full font-semibold`}>
                                <span className={`w-1.5 h-1.5 rounded-full bg-${row.color}-500`} />
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-500 flex-shrink-0"><path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.4" /><path d="M8 6V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="11" r="0.5" fill="currentColor" /></svg>
                    <p className="text-xs text-amber-800"><strong>3 clinicians</strong> have credentials expiring within 14 days. Reminders sent automatically.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social proof strip */}
          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-slate-500 fade-up delay-4">
            {['No long-term contract required', 'Live in under 24 hours', 'No patient PHI stored'].map((text) => (
              <div key={text} className="flex items-center gap-2">
                <CheckIcon />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="py-24 px-6 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <p className="text-primary-400 text-sm font-semibold uppercase tracking-widest mb-3">The Problem</p>
            <h2 className="font-[family-name:var(--font-bricolage)] text-4xl font-bold text-white leading-tight">Your current process is a liability.</h2>
            <p className="mt-4 text-slate-400 text-base leading-relaxed">Most home health agencies are managing clinician compliance the same way they did ten years ago. The tools haven&apos;t kept up with the risk.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Expired licenses slip through', desc: "A spreadsheet with 80 clinicians and quarterly manual reviews is not a compliance system. It's a guessing game — and expired licenses get deployed.", color: 'red' },
              { title: 'Onboarding stalls placements', desc: 'Email chains, missing documents, and chasing follow-ups delay a clinician from going active by days or weeks. Each day is a day of unbillable capacity.', color: 'amber' },
              { title: 'No audit trail when it matters', desc: 'If a surveyor or insurer asks who approved a clinician\'s credentials and when, "I think we have it in a Drive folder somewhere" is not an acceptable answer.', color: 'purple' },
            ].map((item) => (
              <div key={item.title} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6">
                <div className={`w-10 h-10 rounded-xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center mb-5`}>
                  <div className={`w-4 h-4 rounded-full bg-${item.color}-400`} />
                </div>
                <h3 className="font-[family-name:var(--font-bricolage)] font-bold text-white text-base mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 md:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {[
                { stat: '30%', desc: 'of compliance incidents are caused by untracked document expirations', color: 'text-red-400' },
                { stat: '11 days', desc: 'average delay for contract clinician onboarding without a structured process', color: 'text-amber-400' },
                { stat: '$499', desc: 'per month is less than a single missed placement from a compliance hold', color: 'text-primary-400' },
              ].map((item, i) => (
                <div key={item.stat} className={i > 0 ? 'border-t sm:border-t-0 sm:border-l border-slate-700 pt-6 sm:pt-0 sm:pl-8' : ''}>
                  <div className={`text-3xl font-[family-name:var(--font-bricolage)] font-extrabold ${item.color} mb-1`}>{item.stat}</div>
                  <div className="text-slate-400 text-sm">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION SECTION */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary-600 text-sm font-semibold uppercase tracking-widest mb-3">The Solution</p>
              <h2 className="font-[family-name:var(--font-bricolage)] text-4xl font-bold text-slate-900 leading-tight mb-5">Compliance that runs itself. Visibility you can act on.</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">Credentis gives your agency a structured, automated pipeline from clinician invite to Ready-to-Staff status. Every credential has an owner, a due date, and a status — visible at all times.</p>
              <ul className="space-y-4">
                {[
                  { title: 'One readiness status per clinician', desc: 'Ready, Pending, or Not Compliant — calculated automatically from document status.' },
                  { title: 'Automated expiration reminders', desc: '30, 14, and 7 days before expiration. Status flips automatically if nothing is renewed.' },
                  { title: 'Structured checklist templates', desc: 'Build per-discipline templates (PT, OT, SLP, MSW, PTA, COTA) once. Apply consistently across every hire.' },
                  { title: 'Full audit trail', desc: 'Every approval, rejection, and override is timestamped and logged. Ready for any surveyor review.' },
                ].map((item) => (
                  <li key={item.title} className="check-item pl-4 py-1">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 text-sm">{item.title}</span>
                        <p className="text-slate-500 text-sm mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-3">
                <div className="text-xs font-semibold text-slate-500 mb-4">Clinician Checklist — TX Home Health PT</div>
                {[
                  { label: 'TX PT License', sub: 'Approved · Exp. Aug 12, 2026', status: 'Verified', bg: 'green' },
                  { label: 'CPR / BLS Certification', sub: 'Approved · Exp. Jan 5, 2027', status: 'Verified', bg: 'green' },
                  { label: 'TB Test / QuantiFERON', sub: 'Uploaded · Pending Admin Review', status: 'Review', bg: 'amber' },
                  { label: 'W-9 Form', sub: 'Not yet uploaded', status: 'Pending', bg: 'slate' },
                  { label: 'Background Check', sub: 'Not yet uploaded', status: 'Pending', bg: 'slate' },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-3 bg-white border ${item.bg === 'amber' ? 'border-amber-200' : 'border-slate-200'} rounded-xl px-4 py-3`}>
                    <div className={`w-5 h-5 rounded-full ${item.bg === 'green' ? 'bg-green-500' : item.bg === 'amber' ? 'bg-amber-400' : 'bg-slate-300'} flex items-center justify-center flex-shrink-0`}>
                      {item.bg === 'green' ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      ) : item.bg === 'amber' ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 3V5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" /><circle cx="5" cy="7" r="0.5" fill="white" /></svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 5H7" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{item.label}</p>
                      <p className={`text-xs ${item.bg === 'amber' ? 'text-amber-600' : 'text-slate-400'}`}>{item.sub}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.bg === 'green' ? 'bg-green-50 text-green-700' : item.bg === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-2">
                  <div>
                    <p className="text-sm font-bold text-amber-800">Readiness Status</p>
                    <p className="text-xs text-amber-600 mt-0.5">3 of 5 items complete</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 font-bold text-sm px-3 py-1 rounded-full">Not Ready</span>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white border border-slate-200 shadow-xl rounded-xl px-4 py-3 max-w-[200px]">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Reminder sent</p>
                    <p className="text-xs text-slate-500">License expires in 14 days — Sarah M.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-primary-600 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="font-[family-name:var(--font-bricolage)] text-4xl font-bold text-slate-900 mb-4">Built for how agencies actually operate.</h2>
            <p className="text-slate-500 text-base max-w-xl mx-auto">Every feature in Credentis is designed to reduce administrative burden, eliminate compliance risk, and give your team real-time operational clarity.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { title: 'Automated Readiness Status', desc: 'Credentis calculates Ready-to-Staff, Pending, or Not Compliant based on the actual status of every required credential. No manual interpretation needed.' },
              { title: 'Expiration Tracking & Reminders', desc: 'Daily cron jobs check every document expiration date. Automated reminders go out at 30, 14, 7 days — and on day of. Status flips automatically if not renewed.' },
              { title: 'Discipline Checklist Templates', desc: 'Build reusable templates per discipline (PT, OT, SLP, MSW, PTA, COTA). Assign the right checklist to each clinician at creation — no manual setup per hire.' },
              { title: 'Secure Magic Link Upload', desc: 'Clinicians receive a secure, tokenized link to upload their own documents. No account creation. No friction. No credentials to manage for contract staff.' },
              { title: 'Full Audit Trail', desc: 'Every action — approval, rejection, override, status change — is logged with a timestamp and admin identity. Surveyor-ready. Attorney-defensible.' },
              { title: 'Admin Review & Override', desc: 'Admins approve or reject uploaded documents individually. Override controls available for eligible items, with full restrictions on expired license overrides.' },
              { title: 'Multi-Tenant Architecture', desc: 'Each agency is fully isolated. Invite your operations team with role-based access. Data never crosses tenant boundaries — built for healthcare data handling from day one.' },
              { title: 'Document Upload & Storage', desc: 'Clinicians upload licenses, CPR cards, TB results, W-9s, background checks, and more. All stored securely and linked to the specific checklist item.' },
            ].map((f) => (
              <div key={f.title} className="feature-card bg-white border border-slate-200 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-5 text-primary-600">
                  <ShieldCheckIcon />
                </div>
                <h3 className="font-[family-name:var(--font-bricolage)] font-bold text-slate-900 text-base mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
            <div className="feature-card bg-primary-600 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.08),_transparent)]" />
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-5 text-white">
                <ShieldCheckIcon />
              </div>
              <h3 className="font-[family-name:var(--font-bricolage)] font-bold text-white text-base mb-2">No Patient PHI Stored</h3>
              <p className="text-white/70 text-sm leading-relaxed">Credentis is a clinician credentialing platform. It does not store, process, or expose patient health information — reducing your data governance surface significantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-primary-600 text-sm font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="font-[family-name:var(--font-bricolage)] text-4xl font-bold text-slate-900 mb-4">From invite to Ready-to-Staff in one workflow.</h2>
            <p className="text-slate-500 text-base max-w-xl mx-auto">Credentis replaces your email threads and folder chases with a structured pipeline that runs predictably every time.</p>
          </div>
          <div className="relative">
            <div className="hidden lg:block absolute top-8 left-[calc(8%+1rem)] right-[calc(8%+1rem)] h-px bg-slate-200 z-0" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
              {[
                { step: 1, title: 'Admin Creates Record', desc: "Add the clinician's name, discipline, and assign the appropriate checklist template.", highlight: true },
                { step: 2, title: 'Magic Link Sent', desc: 'Clinician receives a secure, one-time link to their personal credential upload portal.', highlight: false },
                { step: 3, title: 'Clinician Uploads', desc: 'They upload each required document directly. No account. No login. No friction.', highlight: false },
                { step: 4, title: 'Admin Reviews', desc: 'Approve or reject each item. Every decision is logged with timestamp and rationale.', highlight: false },
                { step: 5, title: 'Ready to Staff', desc: 'Status updates automatically. Credentis monitors expiration dates from here on — forever.', highlight: true, green: true },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className={`w-16 h-16 rounded-2xl ${s.green ? 'bg-green-500 shadow-lg shadow-green-500/20' : s.highlight ? 'bg-primary-600 shadow-lg shadow-primary-600/20' : 'bg-slate-100'} ${s.green || s.highlight ? 'text-white' : 'text-slate-600'} flex items-center justify-center mx-auto mb-4`}>
                    <span className="font-[family-name:var(--font-bricolage)] font-bold text-lg">{s.step}</span>
                  </div>
                  <h4 className="font-[family-name:var(--font-bricolage)] font-bold text-slate-900 text-sm mb-1">{s.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-14 bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 text-white">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.6" /><path d="M11 7V11L14 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </div>
            <div className="flex-1">
              <h4 className="font-[family-name:var(--font-bricolage)] font-bold text-slate-900 mb-1">After the clinician goes active, Credentis keeps watching.</h4>
              <p className="text-slate-500 text-sm">Daily jobs check every document&apos;s expiration date against the current date. Reminders fire automatically. If a credential isn&apos;t renewed, the clinician&apos;s status flips to Not Compliant — protecting your agency from placing an out-of-compliance clinician without knowing it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-primary-600 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="font-[family-name:var(--font-bricolage)] text-4xl font-bold text-slate-900 mb-4">One plan. No surprises.</h2>
            <p className="text-slate-500 text-base max-w-xl mx-auto">Credentis is priced to be immediately ROI-positive for agencies managing 30 or more contract clinicians.</p>
          </div>
          <div className="max-w-lg mx-auto">
            <div className="bg-white border-2 border-primary-600 rounded-3xl overflow-hidden shadow-xl shadow-primary-600/10">
              <div className="bg-primary-600 px-8 py-4 text-center">
                <span className="text-primary-100 text-sm font-semibold">Agency Plan — Everything Included</span>
              </div>
              <div className="px-8 py-8">
                <div className="flex items-end gap-2 mb-2">
                  <span className="font-[family-name:var(--font-bricolage)] font-extrabold text-5xl text-slate-900">$499</span>
                  <span className="text-slate-500 text-lg mb-2">/month</span>
                </div>
                <p className="text-slate-500 text-sm mb-8">Billed monthly. Cancel anytime. No setup fees.</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Up to <strong>200 active clinicians</strong>',
                    'Unlimited checklist templates',
                    'Automated expiration reminders (30/14/7/day-of)',
                    'Automatic Ready-to-Staff status engine',
                    'Secure magic link clinician upload portal',
                    'Full admin audit trail and override controls',
                    'Multi-admin team access with roles',
                    'Email support with 24h response SLA',
                  ].map((text) => (
                    <li key={text} className="flex items-start gap-3">
                      <CheckIcon className="text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm" dangerouslySetInnerHTML={{ __html: text }} />
                    </li>
                  ))}
                </ul>
                <Link href="/sign-in" className="block w-full text-center bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-primary-600/20 text-sm">
                  Get Started Today
                </Link>
                <p className="text-center text-xs text-slate-400 mt-4">One missed placement from a compliance hold pays for 2+ months of Credentis.</p>
              </div>
            </div>
            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600 text-center leading-relaxed">
              <strong className="text-slate-800">Compare the math:</strong> A single delayed placement from credential chaos typically costs an agency $800–$2,000 in unbilled visits. Credentis at $499/month prevents that — month after month.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-primary-600 text-sm font-semibold uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="font-[family-name:var(--font-bricolage)] text-4xl font-bold text-slate-900">Questions we hear from operations teams.</h2>
          </div>
          <div className="space-y-3">
            <FAQItem question="Is Credentis HIPAA-compliant?" answer="Credentis v1 does not store patient Protected Health Information (PHI). We only store clinician credential data — licenses, certifications, and employment documents. This significantly reduces HIPAA exposure. We implement standard security controls including encrypted storage and access logging. If your legal team requires a formal BAA, please contact us." />
            <FAQItem question="Does the clinician need to create an account?" answer="No. Clinicians receive a secure, tokenized magic link via email. They click the link, upload their documents, and they're done. No username, no password, no app to download. This is intentional — contract clinicians work across multiple agencies and shouldn't be burdened with another account." />
            <FAQItem question="What happens when a credential expires?" answer="Credentis runs daily expiration checks. When a document is within 30 days of expiration, automated reminders are sent at 30, 14, 7, and 0 days. If the document is not renewed and approved before the expiration date, the clinician's status automatically flips to &quot;Not Compliant.&quot; Admins can manually override some credential statuses, but expired licenses cannot be overridden — protecting your agency from placing a clinician with an invalid license." />
            <FAQItem question="Can I customize the checklist for different disciplines?" answer="Yes. You create checklist templates for each discipline your agency works with — PT, OT, SLP, MSW, PTA, COTA, and others. Each template specifies exactly which documents are required, which are optional, and which require an expiration date. When you create a new clinician record, you assign the appropriate template and it applies automatically." />
            <FAQItem question="How quickly can we get set up?" answer="Most agencies are operational within 24 hours of signing up. You'll build your checklist templates (which takes 20-45 minutes depending on how many disciplines you staff), then begin adding clinicians. There's no migration project, no implementation consultant, and no professional services engagement required." />
            <FAQItem question="Is there a contract or long-term commitment?" answer="No. Credentis is month-to-month. You can cancel at any time with no penalty. We don't believe in trapping customers — we believe in building a product that earns continued use every month." />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 bg-primary-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
            No setup fee · No contract · Cancel anytime
          </div>
          <h2 className="font-[family-name:var(--font-bricolage)] text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-5">
            Stop managing compliance<br />in a spreadsheet.
          </h2>
          <p className="text-primary-100 text-lg leading-relaxed mb-10 max-w-xl mx-auto font-light">
            Every day your agency runs on email chains and shared folders is a day you&apos;re exposed to a missed expiration, a delayed placement, and the compliance liability that follows.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/sign-in" className="inline-flex items-center gap-2 bg-white text-primary-700 font-bold px-8 py-4 rounded-xl hover:bg-primary-50 transition-colors shadow-xl shadow-primary-800/20 text-base">
              Get Started Today
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9H14M14 9L10 5M14 9L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <button onClick={() => scrollTo('how-it-works')} className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 transition-colors text-base">
              See How It Works
            </button>
          </div>
          <p className="text-primary-200 text-sm mt-8">$499/month · Live in under 24 hours · No PHI stored</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <CredentisLogo className="w-7 h-7" />
              <span className="font-[family-name:var(--font-bricolage)] font-bold text-white">Credentis</span>
              <span className="text-slate-600 text-sm ml-2">Credential compliance for home health agencies.</span>
            </div>
            <div className="flex gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Terms</a>
              <a href="mailto:support@credentis.com" className="hover:text-slate-300 transition-colors">Contact</a>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-xs text-slate-600 text-center">
            &copy; 2026 Credentis. All rights reserved. Not a HIPAA Business Associate by default — contact us for BAA arrangements.
          </div>
        </div>
      </footer>
    </div>
  );
}
