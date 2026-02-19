'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { ArrowLeft, Upload, FileText, Trash2, Download } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, Input, Spinner } from '@/components/ui';
import {
  fetchTemplateDocuments,
  uploadTemplateDocument,
  deleteTemplateDocument,
  getDocumentDownloadUrl,
  type TemplateDocument,
} from '@/lib/api/templates';

export default function TemplateDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [documents, setDocuments] = useState<TemplateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await fetchTemplateDocuments(token, id);
      setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload() {
    if (!file || !docName) return;
    setUploading(true);
    try {
      const token = await getToken();
      const { uploadUrl } = await uploadTemplateDocument(token, id, {
        name: docName,
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      });

      // Upload file to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setFile(null);
      setDocName('');
      await load();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string, name: string) {
    if (!confirm(`Delete document "${name}"?`)) return;
    try {
      const token = await getToken();
      await deleteTemplateDocument(token, id, docId);
      await load();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  }

  async function handleDownload(docId: string) {
    try {
      const token = await getToken();
      const { url } = await getDocumentDownloadUrl(token, id, docId);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Download failed');
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
        <Link
          href={`/dashboard/templates/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Template
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Template Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload PDFs and contracts that clinicians need to review and sign.
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <CardContent className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Upload Document</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Document Name"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g., Independent Contractor Agreement"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">File</label>
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
          <Button
            size="sm"
            onClick={handleUpload}
            loading={uploading}
            disabled={!file || !docName}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Upload
          </Button>
        </CardContent>
      </Card>

      {/* Documents list */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
          Uploaded Documents ({documents.length})
        </h2>
        {documents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-sm text-slate-500">
              No documents uploaded yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">
                        {doc.mimeType || 'Unknown type'}
                        {doc.fileSizeBytes ? ` · ${Math.round(doc.fileSizeBytes / 1024)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(doc.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(doc.id, doc.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
