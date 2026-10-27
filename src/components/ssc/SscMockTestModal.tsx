import { useState, useEffect } from 'react';
import { Modal } from './SscModal';
import { sscMockTestsService } from '../../services/ssc/sscMockTests.service';
import type { SscMockTest, MockTestForm } from '../../types/ssc.types';

interface SscMockTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  testToEdit?: SscMockTest | null;
  onSaved: (test: SscMockTest) => void;
}

export function SscMockTestModal({
  isOpen,
  onClose,
  userId,
  testToEdit,
  onSaved,
}: SscMockTestModalProps) {
  const [testName, setTestName] = useState('');
  const [testDate, setTestDate] = useState('');
  const [tier, setTier] = useState('Tier-1');
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [attempted, setAttempted] = useState<number | ''>('');
  const [correct, setCorrect] = useState<number | ''>('');
  const [incorrect, setIncorrect] = useState<number | ''>('');
  const [score, setScore] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState<number | ''>(200);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (testToEdit) {
      setTestName(testToEdit.test_name);
      setTestDate(testToEdit.test_date);
      setTier(testToEdit.tier || 'Tier-1');
      setTotalQuestions(testToEdit.total_questions ?? 100);
      setAttempted(testToEdit.attempted ?? '');
      setCorrect(testToEdit.correct ?? '');
      setIncorrect(testToEdit.incorrect ?? '');
      setScore(testToEdit.score ?? '');
      setMaxScore(testToEdit.max_score ?? 200);
      setDurationMinutes(testToEdit.duration_minutes ?? 60);
      setNotes(testToEdit.notes ?? '');
    } else {
      setTestName('');
      setTestDate(new Date().toISOString().split('T')[0]);
      setTier('Tier-1');
      setTotalQuestions(100);
      setAttempted('');
      setCorrect('');
      setIncorrect('');
      setScore('');
      setMaxScore(200);
      setDurationMinutes(60);
      setNotes('');
    }
    setError(null);
  }, [testToEdit, isOpen]);

  // Derived unattempted
  const attNum = typeof attempted === 'number' ? attempted : 0;
  const unattempted = Math.max(0, totalQuestions - attNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim()) {
      setError('Test name is required.');
      return;
    }
    if (!testDate) {
      setError('Date is required.');
      return;
    }

    const att = attempted !== '' ? Number(attempted) : null;
    const cor = correct !== '' ? Number(correct) : null;
    const inc = incorrect !== '' ? Number(incorrect) : null;
    const sc  = score !== '' ? Number(score) : null;
    const mx  = maxScore !== '' ? Number(maxScore) : null;
    const dur = durationMinutes !== '' ? Number(durationMinutes) : null;

    if (att !== null && att > totalQuestions) {
      setError(`Attempted (${att}) cannot exceed Total Questions (${totalQuestions}).`);
      return;
    }
    if (cor !== null && inc !== null && att !== null && (cor + inc > att)) {
      setError(`Correct (${cor}) + Incorrect (${inc}) cannot exceed Attempted (${att}).`);
      return;
    }
    if (sc !== null && mx !== null && sc > mx) {
      setError(`Score (${sc}) cannot exceed Maximum Score (${mx}).`);
      return;
    }

    setSaving(true);
    setError(null);

    const formData: MockTestForm = {
      test_name: testName.trim(),
      test_date: testDate,
      tier: tier.trim() || null,
      total_questions: totalQuestions,
      attempted: att,
      correct: cor,
      incorrect: inc,
      score: sc,
      max_score: mx,
      duration_minutes: dur,
      notes: notes.trim() || null,
    };

    try {
      let saved: SscMockTest;
      if (testToEdit) {
        saved = await sscMockTestsService.update(testToEdit.id, formData);
      } else {
        saved = await sscMockTestsService.create(userId, formData);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save mock test.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={testToEdit ? 'Edit Mock Test' : 'Record Mock Test'}
      width={540}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {error && (
          <div className="ssc-alert ssc-alert-warn" style={{ marginBottom: '0.25rem' }}>
            {error}
          </div>
        )}

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Test Name *</label>
            <input
              type="text"
              className="ssc-input"
              required
              placeholder="e.g. SSC CGL Full Mock 01"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </div>
          <div>
            <label className="ssc-label">Test Date *</label>
            <input
              type="date"
              className="ssc-input"
              required
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </div>
        </div>

        <div className="ssc-form-row-3">
          <div>
            <label className="ssc-label">Exam Tier / Type</label>
            <select
              className="ssc-input"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="Tier-1">Tier-1 Full</option>
              <option value="Tier-2">Tier-2 Full</option>
              <option value="Sectional - Quant">Sectional - Quant</option>
              <option value="Sectional - Reasoning">Sectional - Reasoning</option>
              <option value="Sectional - English">Sectional - English</option>
              <option value="Sectional - GA">Sectional - GA</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="ssc-label">Total Questions</label>
            <input
              type="number"
              min={1}
              className="ssc-input"
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="ssc-label">Duration (min)</label>
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
              max={totalQuestions}
              className="ssc-input"
              placeholder="0"
              value={attempted}
              onChange={(e) => setAttempted(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
          <div>
            <label className="ssc-label">Correct</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              placeholder="0"
              value={correct}
              onChange={(e) => setCorrect(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
          <div>
            <label className="ssc-label">Incorrect</label>
            <input
              type="number"
              min={0}
              className="ssc-input"
              placeholder="0"
              value={incorrect}
              onChange={(e) => setIncorrect(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
          <div>
            <label className="ssc-label">Unattempted</label>
            <input
              type="number"
              disabled
              className="ssc-input"
              style={{ opacity: 0.7, background: 'var(--bg-subtle)' }}
              value={unattempted}
            />
          </div>
        </div>

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Score Obtained</label>
            <input
              type="number"
              step="any"
              className="ssc-input"
              placeholder="e.g. 142.5"
              value={score}
              onChange={(e) => setScore(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
          <div>
            <label className="ssc-label">Maximum Score</label>
            <input
              type="number"
              step="any"
              className="ssc-input"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
        </div>

        <div>
          <label className="ssc-label">Notes & Analysis</label>
          <textarea
            className="ssc-input"
            rows={2}
            placeholder="Weak in Geometry; need to improve reading speed in comprehension..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary ssc-btn-sm" disabled={saving}>
            {saving ? 'Saving…' : testToEdit ? 'Save Changes' : 'Record Test'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
