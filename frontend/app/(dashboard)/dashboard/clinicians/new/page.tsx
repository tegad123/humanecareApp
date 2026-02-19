'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Check } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { createClinician, fetchTemplates, type ChecklistTemplate } from '@/lib/api/admin';

const DISCIPLINES = ['PT', 'OT', 'SLP', 'MSW', 'PTA', 'COTA', 'RN', 'LVN'];

/* ── Custom Dropdown ── */
function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition
            ${disabled ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500'}
            ${open ? 'ring-2 ring-primary-500 border-primary-500' : ''}
          `}
        >
          <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No options</li>
            ) : (
              options.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition
                    ${opt.value === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}
                  `}
                >
                  {opt.label}
                  {opt.value === value && <Check className="h-4 w-4 text-primary-600" />}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NewClinicianPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [npi, setNpi] = useState('');
  const [coverageArea, setCoverageArea] = useState('');

  useEffect(() => {
    async function loadTemplates() {
      try {
        const token = await getToken();
        const data = await fetchTemplates(token);
        setTemplates(data);
      } catch {
        // silently fail — user can still type templateId
      }
    }
    loadTemplates();
  }, [getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !discipline || !templateId) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await createClinician(token, {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        discipline,
        templateId,
        npi: npi || undefined,
        coverageArea: coverageArea || undefined,
      });
      router.push('/dashboard/clinicians');
    } catch (err: any) {
      setError(err.message || 'Failed to create clinician');
    } finally {
      setLoading(false);
    }
  };

  // Filter templates by selected discipline
  const filteredTemplates = discipline
    ? templates.filter(
        (t) => t.discipline === discipline || t.discipline === 'MULTI',
      )
    : templates;

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href="/dashboard/clinicians"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clinicians
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900">Add Clinician</h1>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
              <Input
                label="Last Name *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>

            <Input
              label="Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />

            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-1234"
            />

            {/* Discipline */}
            <Dropdown
              label="Discipline *"
              value={discipline}
              placeholder="Select discipline"
              onChange={(val) => {
                setDiscipline(val);
                setTemplateId('');
              }}
              options={DISCIPLINES.map((d) => ({ value: d, label: d }))}
            />

            {/* Template */}
            <Dropdown
              label="Checklist Template *"
              value={templateId}
              placeholder={discipline ? 'Select template' : 'Select a discipline first'}
              disabled={!discipline}
              onChange={setTemplateId}
              options={filteredTemplates.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />

            <Input
              label="NPI"
              value={npi}
              onChange={(e) => setNpi(e.target.value)}
              placeholder="1234567890"
            />

            <Input
              label="Coverage Area"
              value={coverageArea}
              onChange={(e) => setCoverageArea(e.target.value)}
              placeholder="Houston, TX metro"
            />

            {error && <p className="text-sm text-danger-600">{error}</p>}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create Clinician
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
