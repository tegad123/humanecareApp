'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CredentisLogo } from '@/components/logo';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    agencyName: '',
    requesterName: '',
    workEmail: '',
    phone: '',
    state: '',
    estimatedClinicianCount: '',
    emr: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body: Record<string, any> = {
        agencyName: form.agencyName,
        requesterName: form.requesterName,
        workEmail: form.workEmail,
      };
      if (form.phone) body.phone = form.phone;
      if (form.state) body.state = form.state;
      if (form.estimatedClinicianCount)
        body.estimatedClinicianCount = Number(form.estimatedClinicianCount);
      if (form.emr) body.emr = form.emr;

      const res = await fetch(`${API_URL}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to submit request');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md text-center">
          <CredentisLogo className="w-12 h-12 mx-auto mb-6" />
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12L10 17L19 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Request Submitted</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Thank you for your interest in Credentis. We&apos;ll review your request and
              reach out within 1&ndash;2 business days.
            </p>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Already have an invitation?{' '}
            <Link href="/sign-in" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <CredentisLogo className="w-10 h-10" />
            <span className="font-bold text-xl text-slate-900">Credentis</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Request Access</h1>
          <p className="text-sm text-slate-500">
            Credentis is invite-only for agencies. Fill out the form below and our team
            will be in touch.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          {/* Agency Name */}
          <div>
            <label htmlFor="agencyName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Agency Name <span className="text-red-500">*</span>
            </label>
            <input
              id="agencyName"
              name="agencyName"
              type="text"
              required
              value={form.agencyName}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
              placeholder="e.g. ABC Home Health"
            />
          </div>

          {/* Your Name */}
          <div>
            <label htmlFor="requesterName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              id="requesterName"
              name="requesterName"
              type="text"
              required
              value={form.requesterName}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
              placeholder="Full name"
            />
          </div>

          {/* Work Email */}
          <div>
            <label htmlFor="workEmail" className="block text-sm font-medium text-slate-700 mb-1.5">
              Work Email <span className="text-red-500">*</span>
            </label>
            <input
              id="workEmail"
              name="workEmail"
              type="email"
              required
              value={form.workEmail}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
              placeholder="you@agency.com"
            />
          </div>

          {/* Phone + State row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-1.5">
                State
              </label>
              <select
                id="state"
                name="state"
                value={form.state}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition bg-white"
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Clinician count + EMR row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="estimatedClinicianCount" className="block text-sm font-medium text-slate-700 mb-1.5">
                Estimated Clinicians
              </label>
              <input
                id="estimatedClinicianCount"
                name="estimatedClinicianCount"
                type="number"
                min="1"
                value={form.estimatedClinicianCount}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
                placeholder="e.g. 50"
              />
            </div>
            <div>
              <label htmlFor="emr" className="block text-sm font-medium text-slate-700 mb-1.5">
                Current EMR
              </label>
              <input
                id="emr"
                name="emr"
                type="text"
                value={form.emr}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition"
                placeholder="e.g. Axxess, KanTime"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {submitting ? 'Submitting...' : 'Request Access'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an invitation?{' '}
          <Link href="/sign-in" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
