'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Save, RotateCcw, Eye } from 'lucide-react';
import { Button, Card, CardContent, Input, Spinner } from '@/components/ui';
import {
  fetchEmailSettings,
  updateEmailSettings,
  fetchEmailDefaults,
  type EmailSettings,
} from '@/lib/api/templates';

export default function EmailSettingsPage() {
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const token = await getToken();
      const data = await fetchEmailSettings(token);
      setSettings(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const token = await getToken();
      const updated = await updateEmailSettings(token, {
        subject: settings.subject,
        introText: settings.introText,
        requiredItemsIntro: settings.requiredItemsIntro,
        signatureBlock: settings.signatureBlock,
        legalDisclaimer: settings.legalDisclaimer,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset to default email settings?')) return;
    try {
      const token = await getToken();
      const defaults = await fetchEmailDefaults(token);
      setSettings(defaults);
    } catch (err: any) {
      alert(err.message || 'Failed to load defaults');
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const previewHtml = buildPreview(settings);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Email Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Customize the invite email sent to clinicians when they are added.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            {showPreview ? 'Hide Preview' : 'Preview'}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saved ? 'Saved!' : 'Save'}
          </Button>
        </div>
      </div>

      <div className={showPreview ? 'grid grid-cols-2 gap-6' : ''}>
        {/* Settings form */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <Input
                label="Email Subject"
                value={settings.subject}
                onChange={(e) => setSettings({ ...settings, subject: e.target.value })}
                placeholder="Use {{orgName}} for your agency name"
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Intro Text
                </label>
                <textarea
                  value={settings.introText}
                  onChange={(e) => setSettings({ ...settings, introText: e.target.value })}
                  rows={3}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Use {{orgName}} for your agency name"
                />
              </div>

              <Input
                label="Required Items Intro"
                value={settings.requiredItemsIntro}
                onChange={(e) => setSettings({ ...settings, requiredItemsIntro: e.target.value })}
                placeholder="Text shown before the required items list"
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Signature Block
                </label>
                <textarea
                  value={settings.signatureBlock}
                  onChange={(e) => setSettings({ ...settings, signatureBlock: e.target.value })}
                  rows={2}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Use {{orgName}} for your agency name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Legal Disclaimer
                </label>
                <textarea
                  value={settings.legalDisclaimer}
                  onChange={(e) => setSettings({ ...settings, legalDisclaimer: e.target.value })}
                  rows={2}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional legal text at the bottom of the email"
                />
              </div>

              <p className="text-xs text-slate-400">
                Tip: Use {'{{orgName}}'} anywhere to insert your organization name.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {showPreview && (
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Email Preview</h3>
              <div
                className="border border-slate-200 rounded-lg p-4 bg-white text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function buildPreview(settings: EmailSettings): string {
  const orgName = 'Your Agency';
  const subject = settings.subject.replace(/\{\{orgName\}\}/g, orgName);
  const intro = settings.introText.replace(/\{\{orgName\}\}/g, orgName);
  const sig = settings.signatureBlock.replace(/\{\{orgName\}\}/g, orgName).replace(/\n/g, '<br/>');

  return `
    <div style="font-family: sans-serif; max-width: 500px;">
      <p style="color: #64748b; font-size: 12px; margin-bottom: 8px;">Subject: ${subject}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;"/>
      <h2 style="color: #1e293b; font-size: 18px;">Welcome to ${orgName}</h2>
      <p>Hi Jane Doe,</p>
      <p>${intro}</p>
      ${settings.requiredItemsIntro ? `
        <p style="font-weight: 600; margin-top: 12px;">${settings.requiredItemsIntro}</p>
        <ul style="color: #334155; padding-left: 20px;">
          <li>State License</li>
          <li>Professional Liability Insurance</li>
          <li>CPR/BLS Certification</li>
        </ul>
      ` : ''}
      <p style="margin: 20px 0;">
        <span style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 600;">
          Accept Invite & Get Started
        </span>
      </p>
      <p style="color: #64748b; font-size: 13px;">This invite link will expire in 7 days.</p>
      <p style="color: #64748b; font-size: 13px;">${sig}</p>
      ${settings.legalDisclaimer ? `
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;"/>
        <p style="color: #94a3b8; font-size: 11px;">${settings.legalDisclaimer}</p>
      ` : ''}
    </div>
  `;
}
