'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  Upload,
  FileText,
  Trash2,
  Download,
  FolderOpen,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import { Button, Card, CardContent, Input, Spinner, Badge } from '@/components/ui';
import {
  fetchOrgDocuments,
  uploadOrgDocument,
  updateOrgDocument,
  deleteOrgDocument,
  getOrgDocumentDownloadUrl,
  type OrgDocument,
} from '@/lib/api/org-documents';

const CATEGORIES = [
  { value: 'contract', label: 'Contract' },
  { value: 'form', label: 'Form' },
  { value: 'policy', label: 'Policy' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
  contract: 'info',
  form: 'success',
  policy: 'warning',
  agreement: 'neutral',
  other: 'neutral',
};

export default function OrgDocumentsPage() {
  const { getToken } = useAuth();

  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('other');
  const [docDescription, setDocDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await fetchOrgDocuments(token);
      setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload() {
    if (!file || !docName) return;
    setUploading(true);
    try {
      const token = await getToken();
      const { uploadUrl } = await uploadOrgDocument(token, {
        name: docName,
        category: docCategory,
        description: docDescription || undefined,
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      });

      // Upload file directly to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setFile(null);
      setDocName('');
      setDocCategory('other');
      setDocDescription('');
      await load();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string, name: string) {
    if (!confirm(`Delete document "${name}"? Any template items linked to this document will be unlinked.`)) return;
    try {
      const token = await getToken();
      await deleteOrgDocument(token, docId);
      await load();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  }

  async function handleDownload(docId: string) {
    try {
      const token = await getToken();
      const { url } = await getOrgDocumentDownloadUrl(token, docId);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Download failed');
    }
  }

  function startEditing(doc: OrgDocument) {
    setEditingId(doc.id);
    setEditName(doc.name);
    setEditCategory(doc.category);
  }

  async function handleSaveEdit(docId: string) {
    try {
      const token = await getToken();
      await updateOrgDocument(token, docId, {
        name: editName,
        category: editCategory,
      });
      setEditingId(null);
      await load();
    } catch (err: any) {
      alert(err.message || 'Update failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Document Library</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload your organization&apos;s standard documents — contracts, forms, and policies that
          clinicians need to fill out. These can be linked to any template&apos;s checklist items.
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <CardContent className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Upload Document</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Document Name"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g., Independent Contractor Agreement"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Category
              </label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                File
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm cursor-pointer hover:border-primary-400 transition">
                <Upload className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600 truncate">
                  {file ? file.name : 'Choose file...'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
          <Input
            label="Description (optional)"
            value={docDescription}
            onChange={(e) => setDocDescription(e.target.value)}
            placeholder="Brief description of what this document is for..."
          />
          <Button
            size="sm"
            onClick={handleUpload}
            loading={uploading}
            disabled={!file || !docName}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Upload Document
          </Button>
        </CardContent>
      </Card>

      {/* Documents list */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
          Organization Documents ({documents.length})
        </h2>
        {documents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FolderOpen className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600 mb-1">
                No documents uploaded yet
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload your contracts, I-9 forms, W-9 forms, direct deposit forms, policies, and
                other documents your clinicians need to fill out.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                    {editingId === doc.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm font-medium border border-slate-300 rounded px-2 py-1 flex-1"
                        />
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="text-xs border border-slate-300 rounded px-2 py-1"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleSaveEdit(doc.id)}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {doc.name}
                          </p>
                          <Badge variant={CATEGORY_COLORS[doc.category] as any || 'neutral'}>
                            {doc.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {doc.mimeType || 'Unknown type'}
                          {doc.fileSizeBytes
                            ? ` · ${Math.round(doc.fileSizeBytes / 1024)} KB`
                            : ''}
                          {doc.description ? ` · ${doc.description}` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                  {editingId !== doc.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(doc.id)}
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(doc)}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(doc.id, doc.name)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-danger-500" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
