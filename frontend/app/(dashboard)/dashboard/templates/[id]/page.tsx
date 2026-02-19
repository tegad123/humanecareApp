'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { Button, Badge, Card, CardContent, Input, Spinner } from '@/components/ui';
import {
  fetchTemplate,
  updateItemDefinition,
  createItemDefinition,
  deleteItemDefinition,
  type Template,
  type ItemDefinition,
} from '@/lib/api/templates';

const ITEM_TYPES = [
  { value: 'file_upload', label: 'File Upload' },
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'e_signature', label: 'E-Signature' },
  { value: 'admin_status', label: 'Admin Status' },
];

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New item form
  const [newItem, setNewItem] = useState({
    label: '',
    section: '',
    type: 'file_upload',
    required: true,
    blocking: false,
    highRisk: false,
    instructions: '',
  });

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await fetchTemplate(token, id);
      setTemplate(data);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleUpdateItem(defId: string, field: string, value: any) {
    setSaving(defId);
    try {
      const token = await getToken();
      await updateItemDefinition(token, id, defId, { [field]: value });
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteItem(defId: string) {
    if (!confirm('Remove this item from the template?')) return;
    try {
      const token = await getToken();
      await deleteItemDefinition(token, id, defId);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  }

  async function handleAddItem() {
    if (!newItem.label || !newItem.section) return;
    try {
      const token = await getToken();
      await createItemDefinition(token, id, {
        label: newItem.label,
        section: newItem.section,
        type: newItem.type,
        required: newItem.required,
        blocking: newItem.blocking,
        highRisk: newItem.highRisk,
        instructions: newItem.instructions || undefined,
      });
      setNewItem({ label: '', section: '', type: 'file_upload', required: true, blocking: false, highRisk: false, instructions: '' });
      setShowAddForm(false);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to add item');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!template) {
    return <p className="text-slate-500 p-4">Template not found</p>;
  }

  const items = template.itemDefinitions || [];
  const sections = [...new Set(items.map((i) => i.section))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/templates"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Templates
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{template.name}</h1>
          <p className="text-sm text-slate-500">
            {template.discipline} {template.state ? `- ${template.state}` : ''}
            {' '}&middot;{' '}{items.length} items
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/dashboard/templates/${id}/documents`)}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Documents
          </Button>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => {
        const sectionItems = items.filter((i) => i.section === section);
        return (
          <div key={section} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              {section}
            </h2>
            <div className="space-y-1">
              {sectionItems.map((item) => (
                <Card
                  key={item.id}
                  className={`transition ${!item.enabled ? 'opacity-50' : ''}`}
                >
                  <CardContent className="py-2">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() =>
                        setExpandedItem(expandedItem === item.id ? null : item.id)
                      }
                    >
                      <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {item.label}
                          </span>
                          {item.highRisk && (
                            <AlertTriangle className="h-3.5 w-3.5 text-warning-500 shrink-0" />
                          )}
                          {!item.enabled && (
                            <Badge status="expired">Disabled</Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {ITEM_TYPES.find((t) => t.value === item.type)?.label || item.type}
                          {item.required && ' · Required'}
                          {item.blocking && ' · Blocking'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {saving === item.id && <Spinner size="sm" />}
                        {expandedItem === item.id ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded editor */}
                    {expandedItem === item.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Label"
                            value={item.label}
                            onChange={() => {}}
                            onBlur={(e) => {
                              if (e.target.value !== item.label) {
                                handleUpdateItem(item.id, 'label', e.target.value);
                              }
                            }}
                            defaultValue={item.label}
                          />
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-700">Type</label>
                            <select
                              value={item.type}
                              onChange={(e) => handleUpdateItem(item.id, 'type', e.target.value)}
                              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              {ITEM_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Instructions</label>
                          <textarea
                            defaultValue={item.instructions || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (item.instructions || '')) {
                                handleUpdateItem(item.id, 'instructions', e.target.value || null);
                              }
                            }}
                            rows={2}
                            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Instructions for the clinician..."
                          />
                        </div>

                        <div className="flex flex-wrap gap-4">
                          {[
                            { key: 'required', label: 'Required' },
                            { key: 'blocking', label: 'Blocking' },
                            { key: 'highRisk', label: 'High Risk' },
                            { key: 'enabled', label: 'Enabled' },
                            { key: 'hasExpiration', label: 'Has Expiration' },
                          ].map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={(item as any)[key]}
                                onChange={(e) => handleUpdateItem(item.id, key, e.target.checked)}
                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                              />
                              {label}
                            </label>
                          ))}
                        </div>

                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add Item Form */}
      {showAddForm ? (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Add New Item</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Label"
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                placeholder="e.g., Auto Insurance"
              />
              <Input
                label="Section"
                value={newItem.section}
                onChange={(e) => setNewItem({ ...newItem, section: e.target.value })}
                placeholder="e.g., HR & Pay"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Type</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Instructions</label>
                <input
                  value={newItem.instructions}
                  onChange={(e) => setNewItem({ ...newItem, instructions: e.target.value })}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional clinician guidance"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'required', label: 'Required' },
                { key: 'blocking', label: 'Blocking' },
                { key: 'highRisk', label: 'High Risk' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(newItem as any)[key]}
                    onChange={(e) => setNewItem({ ...newItem, [key]: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddItem} disabled={!newItem.label || !newItem.section}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      )}
    </div>
  );
}
