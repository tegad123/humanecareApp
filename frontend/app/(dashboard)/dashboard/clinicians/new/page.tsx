'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { createClinician, fetchTemplates, type ChecklistTemplate } from '@/lib/api/admin';

const DISCIPLINES = ['PT', 'OT', 'SLP', 'MSW', 'PTA', 'COTA', 'RN', 'LVN'];

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
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Discipline *
              </label>
              <select
                value={discipline}
                onChange={(e) => {
                  setDiscipline(e.target.value);
                  setTemplateId(''); // reset template when discipline changes
                }}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select discipline</option>
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Template */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Checklist Template *
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={!discipline}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              >
                <option value="">
                  {discipline ? 'Select template' : 'Select a discipline first'}
                </option>
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

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
