import { useState, useEffect } from 'react';
import { Modal } from './SscModal';
import { ConfidenceStars } from './SscBadges';
import { sscRevisionService } from '../../services/ssc/sscRevision.service';
import type { SscRevisionSession, RevisionSessionForm } from '../../types/ssc.types';

interface SscRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  chapterId: string;
  revisionToEdit?: SscRevisionSession | null;
  onSaved: (rev: SscRevisionSession) => void;
}

export function SscRevisionModal({
  isOpen,
  onClose,
  userId,
  chapterId,
  revisionToEdit,
  onSaved,
}: SscRevisionModalProps) {
  const [revisionDate, setRevisionDate] = useState('');
  const [attempted, setAttempted] = useState<number | ''>('');
  const [correct, setCorrect] = useState<number | ''>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [nextRevisionAt, setNextRevisionAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (revisionToEdit) {
      setRevisionDate(revisionToEdit.revision_date);
      setAttempted(revisionToEdit.attempted ?? '');
      setCorrect(revisionToEdit.correct ?? '');
      setConfidence(revisionToEdit.confidence_rating ?? null);
      setNextRevisionAt(
        revisionToEdit.next_revision_at
          ? revisionToEdit.next_revision_at.split('T')[0]
          : ''
      );
      setNotes(revisionToEdit.notes ?? '');
    } else {
      setRevisionDate(new Date().toISOString().split('T')[0]);
      setAttempted('');
      setCorrect('');
      setConfidence(3);
      setNextRevisionAt('');
      setNotes('');
    }
    setError(null);
  }, [revisionToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionDate) {
      setError('Revision date is required.');
      return;
    }

    const att = attempted !== '' ? Number(attempted) : null;
    const cor = correct !== '' ? Number(correct) : null;

    if (att !== null && cor !== null && cor > att) {
      setError(`Correct (${cor}) cannot exceed Attempted (${att}).`);
      return;
    }

    setSaving(true);
    setError(null);

    const formData: RevisionSessionForm = {
      chapter_id: chapterId,
      revision_date: revisionDate,
      attempted: att,
      correct: cor,
      confidence_rating: confidence,
      notes: notes.trim() || null,
      next_revision_at: nextRevisionAt ? new Date(nextRevisionAt).toISOString() : null,
    };

    try {
      let saved: SscRevisionSession;
      if (revisionToEdit) {
        saved = await sscRevisionService.update(revisionToEdit.id, formData);
      } else {
        saved = await sscRevisionService.create(userId, formData);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save revision session.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={revisionToEdit ? 'Edit Revision Record' : 'Record Revision Session'}
      width={480}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {error && (
          <div className="ssc-alert ssc-alert-warn" style={{ marginBottom: '0.25rem' }}>
            {error}
          </div>
        )}

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Revision Date *</label>
            <input
              type="date"
              className="ssc-input"
              required
              value={revisionDate}
              onChange={(e) => setRevisionDate(e.target.value)}
            />
          </div>

          <div>
            <label className="ssc-label">Next Revision Date</label>
            <input
              type="date"
              className="ssc-input"
              value={nextRevisionAt}
              onChange={(e) => setNextRevisionAt(e.target.value)}
            />
          </div>
        </div>

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Questions Attempted</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              placeholder="e.g. 20"
              value={attempted}
              onChange={(e) => setAttempted(e.target.value ? Number(e.target.value) : '')}
            />
          </div>

          <div>
            <label className="ssc-label">Correct Answers</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              placeholder="e.g. 18"
              value={correct}
              onChange={(e) => setCorrect(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
        </div>

        <div>
          <label className="ssc-label" style={{ marginBottom: '0.4rem' }}>Confidence Rating</label>
          <ConfidenceStars
            rating={confidence}
            interactive
            onChange={(r) => setConfidence(r)}
          />
        </div>

        <div>
          <label className="ssc-label">Revision Notes</label>
          <textarea
            className="ssc-input"
            rows={2}
            placeholder="Revised short tricks for trigonometry angles..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary ssc-btn-sm" disabled={saving}>
            {saving ? 'Saving…' : revisionToEdit ? 'Save Changes' : 'Record Revision'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
