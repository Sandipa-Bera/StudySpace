import { useState, useEffect } from 'react';
import { Modal } from './SscModal';
import { sscPracticeService } from '../../services/ssc/sscPractice.service';
import type { SscPracticeSession, PracticeSessionForm } from '../../types/ssc.types';

interface SscPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  chapterId: string;
  subjectId: string;
  sessionToEdit?: SscPracticeSession | null;
  onSaved: (session: SscPracticeSession) => void;
}

export function SscPracticeModal({
  isOpen,
  onClose,
  userId,
  chapterId,
  subjectId,
  sessionToEdit,
  onSaved,
}: SscPracticeModalProps) {
  const [sessionDate, setSessionDate] = useState('');
  const [attempted, setAttempted] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionToEdit) {
      setSessionDate(sessionToEdit.session_date);
      setAttempted(sessionToEdit.attempted);
      setCorrect(sessionToEdit.correct);
      setIncorrect(sessionToEdit.incorrect);
      setSkipped(sessionToEdit.skipped);
      setDurationMinutes(sessionToEdit.duration_minutes ?? '');
      setSource(sessionToEdit.practice_source ?? '');
      setNotes(sessionToEdit.notes ?? '');
    } else {
      setSessionDate(new Date().toISOString().split('T')[0]);
      setAttempted(25);
      setCorrect(20);
      setIncorrect(5);
      setSkipped(0);
      setDurationMinutes(30);
      setSource('');
      setNotes('');
    }
    setError(null);
  }, [sessionToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionDate) {
      setError('Session date is required.');
      return;
    }
    if (attempted < 0 || correct < 0 || incorrect < 0 || skipped < 0) {
      setError('Counts cannot be negative.');
      return;
    }
    if (correct + incorrect + skipped > attempted) {
      setError('Correct + Incorrect + Skipped cannot exceed Attempted.');
      return;
    }

    setSaving(true);
    setError(null);

    const formData: PracticeSessionForm = {
      chapter_id: chapterId,
      subject_id: subjectId,
      session_date: sessionDate,
      attempted,
      correct,
      incorrect,
      skipped,
      duration_minutes: durationMinutes !== '' ? Number(durationMinutes) : null,
      practice_source: source.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      let saved: SscPracticeSession;
      if (sessionToEdit) {
        saved = await sscPracticeService.update(sessionToEdit.id, formData);
      } else {
        saved = await sscPracticeService.create(userId, formData);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save practice session.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={sessionToEdit ? 'Edit Practice Session' : 'Log Practice Session'}
      width={500}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {error && (
          <div className="ssc-alert ssc-alert-warn" style={{ marginBottom: '0.25rem' }}>
            {error}
          </div>
        )}

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Session Date *</label>
            <input
              type="date"
              className="ssc-input"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          <div>
            <label className="ssc-label">Duration (Minutes)</label>
            <input
              type="number"
              min={1}
              className="ssc-input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
        </div>

        <div className="ssc-form-row-4">
          <div>
            <label className="ssc-label">Attempted</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              value={attempted}
              onChange={(e) => setAttempted(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="ssc-label">Correct</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              value={correct}
              onChange={(e) => setCorrect(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="ssc-label">Incorrect</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              value={incorrect}
              onChange={(e) => setIncorrect(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="ssc-label">Skipped</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              value={skipped}
              onChange={(e) => setSkipped(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="ssc-label">Source / Book / Test</label>
          <input
            type="text"
            className="ssc-input"
            placeholder="e.g. Kiran PYQ 2023, Pinnacle 6800+"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>

        <div>
          <label className="ssc-label">Notes</label>
          <textarea
            className="ssc-input"
            rows={2}
            placeholder="Focus on speed in calculation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary ssc-btn-sm" disabled={saving}>
            {saving ? 'Saving…' : sessionToEdit ? 'Save Changes' : 'Log Session'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
