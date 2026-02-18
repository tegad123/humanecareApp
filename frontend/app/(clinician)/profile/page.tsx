'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Stethoscope,
  Hash,
} from 'lucide-react';
import { Card, CardContent, Spinner } from '@/components/ui';
import { fetchMyProfile, type Clinician } from '@/lib/api/clinicians';

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-900">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { getToken } = useAuth();
  const [clinician, setClinician] = useState<Clinician | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const data = await fetchMyProfile(token);
        setClinician(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !clinician) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-600">{error || 'Profile not found'}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">My Profile</h1>

      <Card>
        <CardContent>
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-lg font-semibold">
              {clinician.firstName[0]}
              {clinician.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {clinician.firstName} {clinician.lastName}
              </p>
              <p className="text-sm text-slate-500">{clinician.discipline}</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            <InfoRow icon={Mail} label="Email" value={clinician.email} />
            <InfoRow icon={Phone} label="Phone" value={clinician.phone} />
            <InfoRow icon={Stethoscope} label="Discipline" value={clinician.discipline} />
            <InfoRow icon={Hash} label="NPI" value={clinician.npi} />
            <InfoRow icon={MapPin} label="Coverage Area" value={clinician.coverageArea} />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 text-center">
        Contact your agency to update your profile information.
      </p>
    </div>
  );
}
