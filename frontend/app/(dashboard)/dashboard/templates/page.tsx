'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ClipboardList, Copy, Pencil, ChevronRight } from 'lucide-react';
import { Button, Badge, Card, CardContent, Spinner } from '@/components/ui';
import { fetchTemplates, cloneTemplate, type Template } from '@/lib/api/templates';

export default function TemplatesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const token = await getToken();
      const data = await fetchTemplates(token);
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleClone(templateId: string) {
    setCloning(templateId);
    try {
      const token = await getToken();
      const cloned = await cloneTemplate(token, templateId);
      router.push(`/dashboard/templates/${cloned.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to clone template');
    } finally {
      setCloning(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const globalTemplates = templates.filter((t) => !t.organizationId);
  const orgTemplates = templates.filter((t) => t.organizationId);

  return (
    <div className="space-y-6">
      <div data-tour="templates-header">
        <h1 className="text-xl font-semibold text-slate-900">Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Customize checklist templates for your agency. Clone a global template to start editing.
        </p>
      </div>

      {/* Org Customized Templates */}
      {orgTemplates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
            Your Customized Templates
          </h2>
          <div className="grid gap-3">
            {orgTemplates.map((t) => (
              <div
                key={t.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/templates/${t.id}`)}
              >
              <Card className="hover:shadow-md transition">
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50">
                      <ClipboardList className="h-4 w-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        {t.discipline} {t.state ? `- ${t.state}` : ''}
                        {' '}&middot;{' '}{t._count?.itemDefinitions ?? 0} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status="approved">Customized</Badge>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Templates */}
      <div data-tour="global-templates" className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
          Global Templates
        </h2>
        <div className="grid gap-3">
          {globalTemplates.map((t) => {
            const hasClone = orgTemplates.some((ot) => ot.sourceTemplateId === t.id);
            return (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                      <ClipboardList className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        {t.discipline} {t.state ? `- ${t.state}` : ''}
                        {' '}&middot;{' '}{t._count?.itemDefinitions ?? 0} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasClone ? (
                      <span className="text-xs text-slate-400">Already customized</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClone(t.id);
                        }}
                        loading={cloning === t.id}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Customize
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
