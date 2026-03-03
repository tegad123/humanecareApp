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
  Upload,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { Button, Badge, Card, CardContent, Input, Spinner, Modal } from '@/components/ui';
import {
  fetchTemplate,
  fetchTemplateDocuments,
  updateItemDefinition,
  createItemDefinition,
  deleteItemDefinition,
  publishTemplate,
  type Template,
  type ItemDefinition,
  type TemplateDocument,
} from '@/lib/api/templates';
import {
  fetchOrgDocuments,
  uploadOrgDocument,
  type OrgDocument,
} from '@/lib/api/org-documents';

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

  // Available documents for linking
  const [orgDocs, setOrgDocs] = useState<OrgDocument[]>([]);
  const [templateDocs, setTemplateDocs] = useState<TemplateDocument[]>([]);

  // Upload & Link modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetDefId, setUploadTargetDefId] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('form');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishChecklist, setPublishChecklist] = useState({
    reviewedLicense: false,
    reviewedBackgroundCheck: false,
    reviewedExclusionCheck: false,
    reviewedLiabilityInsurance: false,
    reviewedOrientation: false,
    reviewedStateSpecificItems: false,
    attestationAccepted: false,
    jurisdictionState: '',
  });

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

  // Track if the add-form has unsaved data
  const hasUnsavedNewItem = showAddForm && (newItem.label.trim() !== '' || newItem.section.trim() !== '');

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedNewItem) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedNewItem]);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [data, orgDocsData, templateDocsData] = await Promise.all([
        fetchTemplate(token, id),
        fetchOrgDocuments(token).catch(() => []),
        fetchTemplateDocuments(token, id).catch(() => []),
      ]);
      setTemplate(data);
      setOrgDocs(orgDocsData);
      setTemplateDocs(templateDocsData);
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

  // Upload & Link helpers
  function openUploadModal(defId: string) {
    setUploadTargetDefId(defId);
    setUploadName('');
    setUploadCategory('form');
    setUploadFile(null);
    setUploadError(null);
    setUploadModalOpen(true);
  }

  function resetUploadModal() {
    setUploadModalOpen(false);
    setUploadTargetDefId(null);
    setUploadName('');
    setUploadCategory('form');
    setUploadFile(null);
    setUploadError(null);
  }

  async function handleUploadAndLink() {
    if (!uploadFile || !uploadName.trim() || !uploadTargetDefId) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (uploadFile.size > MAX_FILE_SIZE) {
      setUploadError('File size must be under 10 MB.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    try {
      const token = await getToken();

      // Step 1: Create org document record + get presigned URL
      const { document, uploadUrl } = await uploadOrgDocument(token, {
        name: uploadName.trim(),
        category: uploadCategory,
        fileName: uploadFile.name,
        contentType: uploadFile.type,
        fileSizeBytes: uploadFile.size,
      });

      // Step 2: Upload file to S3
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        body: uploadFile,
        headers: { 'Content-Type': uploadFile.type },
      });
      if (!uploadResp.ok) throw new Error('File upload failed. Please try again.');

      // Step 3: Auto-link document to the target item
      await updateItemDefinition(token, id, uploadTargetDefId, {
        linkedDocumentId: document.id,
      });

      // Step 4: Close modal & refresh
      resetUploadModal();
      await load();
    } catch (err: any) {
      setUploadError(err.message || 'Something went wrong during upload.');
    } finally {
      setUploadLoading(false);
    }
  }

  async function handlePublishTemplate() {
    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);
    try {
      const token = await getToken();
      const result = await publishTemplate(token, id, {
        ...publishChecklist,
        jurisdictionState:
          publishChecklist.jurisdictionState.trim() || undefined,
      });
      setTemplate((prev) =>
        prev
          ? {
              ...prev,
              publishedRevision: result.publishedRevision,
              lastPublishedAt: result.publishedAt,
            }
          : prev,
      );
      setPublishSuccess(
        `Published revision ${result.publishedRevision} at ${new Date(result.publishedAt).toLocaleString()}.`,
      );
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish template');
    } finally {
      setPublishing(false);
    }
  }

  function getLinkedDocName(docId: string): string {
    const org = orgDocs.find((d) => d.id === docId);
    if (org) return org.name;
    const tmpl = templateDocs.find((d) => d.id === docId);
    if (tmpl) return tmpl.name;
    return 'Unknown document';
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

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Template Publish Checklist
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Publishing records a compliance attestation and increments a revision.
              </p>
            </div>
            <Badge variant="neutral">
              Revision {template.publishedRevision ?? 0}
            </Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['reviewedLicense', 'License requirements reviewed'],
              ['reviewedBackgroundCheck', 'Background check requirements reviewed'],
              ['reviewedExclusionCheck', 'Exclusion/OIG checks reviewed'],
              ['reviewedLiabilityInsurance', 'Liability insurance requirements reviewed'],
              ['reviewedOrientation', 'Orientation requirements reviewed'],
              ['reviewedStateSpecificItems', 'State-specific requirements reviewed'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={(publishChecklist as any)[key]}
                  onChange={(e) =>
                    setPublishChecklist((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                {label}
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Jurisdiction (optional)
            </label>
            <input
              value={publishChecklist.jurisdictionState}
              onChange={(e) =>
                setPublishChecklist((prev) => ({
                  ...prev,
                  jurisdictionState: e.target.value,
                }))
              }
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g., Texas"
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={publishChecklist.attestationAccepted}
              onChange={(e) =>
                setPublishChecklist((prev) => ({
                  ...prev,
                  attestationAccepted: e.target.checked,
                }))
              }
              className="mt-0.5 rounded border-amber-400 text-primary-600 focus:ring-primary-500"
            />
            I attest this template meets applicable federal, state, accreditation, and payer requirements for this role in my jurisdiction.
          </label>

          {template.lastPublishedAt && (
            <p className="text-xs text-slate-500">
              Last published at {new Date(template.lastPublishedAt).toLocaleString()}.
            </p>
          )}

          {publishError && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {publishError}
            </div>
          )}
          {publishSuccess && (
            <div className="rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-700">
              {publishSuccess}
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={handlePublishTemplate} loading={publishing}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Publish Template
            </Button>
          </div>
        </CardContent>
      </Card>

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

                        {/* Link Document — for file_upload and e_signature items */}
                        {(item.type === 'file_upload' || item.type === 'e_signature') && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Linked Document
                              <span className="font-normal text-slate-400 ml-1">
                                {item.type === 'file_upload'
                                  ? '(clinician downloads this form, fills it out, then uploads)'
                                  : '(document shown for e-signature review)'}
                              </span>
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                value={item.linkedDocumentId || ''}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.id,
                                    'linkedDocumentId',
                                    e.target.value || null,
                                  )
                                }
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                              >
                                <option value="">No linked document</option>
                                {orgDocs.length > 0 && (
                                  <optgroup label="Organization Documents">
                                    {orgDocs.map((doc) => (
                                      <option key={doc.id} value={doc.id}>
                                        {doc.name} ({doc.category})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {templateDocs.length > 0 && (
                                  <optgroup label="Template Documents">
                                    {templateDocs.map((doc) => (
                                      <option key={doc.id} value={doc.id}>
                                        {doc.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openUploadModal(item.id)}
                              >
                                <Upload className="h-3.5 w-3.5 mr-1" />
                                Upload &amp; Link
                              </Button>
                            </div>
                            {item.linkedDocumentId && (
                              <p className="text-xs text-slate-500 mt-1">
                                Linked to: {getLinkedDocName(item.linkedDocumentId)}
                              </p>
                            )}
                          </div>
                        )}

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

      {/* Upload & Link Modal */}
      <Modal
        open={uploadModalOpen}
        onClose={resetUploadModal}
        title="Upload & Link Document"
      >
        <div className="space-y-4">
          {uploadError && (
            <div className="rounded-lg bg-danger-50 border border-danger-200 text-danger-700 text-sm p-3">
              {uploadError}
            </div>
          )}

          <Input
            label="Document Name"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="e.g., W-9 Form"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="form">Form</option>
              <option value="contract">Contract</option>
              <option value="policy">Policy</option>
              <option value="agreement">Agreement</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              File
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm cursor-pointer hover:border-primary-400 transition">
              <Upload className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600 truncate">
                {uploadFile ? uploadFile.name : 'Choose file...'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setUploadFile(f);
                  if (f && !uploadName.trim()) {
                    setUploadName(f.name.replace(/\.[^.]+$/, ''));
                  }
                }}
              />
            </label>
            {uploadFile && (
              <p className="text-xs text-slate-500 mt-1">
                {Math.round(uploadFile.size / 1024)} KB
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetUploadModal}
              disabled={uploadLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUploadAndLink}
              loading={uploadLoading}
              disabled={!uploadFile || !uploadName.trim() || uploadLoading}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload &amp; Link
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
