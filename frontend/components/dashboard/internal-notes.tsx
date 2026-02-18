'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { MessageSquare } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { addNote, type InternalNote } from '@/lib/api/admin';

interface InternalNotesProps {
  clinicianId: string;
  notes: InternalNote[];
  onNoteAdded: (note: InternalNote) => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function InternalNotes({ clinicianId, notes, onNoteAdded }: InternalNotesProps) {
  const { getToken } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const note = await addNote(token, clinicianId, content.trim());
      onNoteAdded(note);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Internal Notes
      </h3>

      {/* Add note form */}
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="Add a note..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <Button
          onClick={handleSubmit}
          loading={submitting}
          disabled={!content.trim()}
          size="sm"
          className="self-end"
        >
          Add
        </Button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">
                    {note.author.name || note.author.email}
                  </span>
                  <span className="text-xs text-slate-400">
                    {timeAgo(note.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {note.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
