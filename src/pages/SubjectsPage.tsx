import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { subjectsService } from '../services/subjects.service';
import { chaptersService } from '../services/chapters.service';
import { topicsService } from '../services/topics.service';
import { Modal } from '../components/ui/Modal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { calcProgress } from '../utils/progress';
import type { Subject, SubjectFormData, Chapter, Topic } from '../types';

interface SubjectWithStats extends Subject {
  chapters: number;
  total: number;
  completed: number;
}

type ModalMode = 'add' | 'edit' | 'delete';

export function SubjectsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormData>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadSubjects();
  }, [user]);

  const loadSubjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const raw = await subjectsService.getAll(user.id);
      const withStats = await Promise.all(
        raw.map(async (s) => {
          const chapters: Chapter[] = await chaptersService.getBySubject(s.id);
          const topicsArrays: Topic[][] = await Promise.all(
            chapters.map((ch) => topicsService.getByChapter(ch.id))
          );
          const topics = topicsArrays.flat();
          return {
            ...s,
            chapters: chapters.length,
            total: topics.length,
            completed: topics.filter((t) => t.is_completed).length,
          };
        })
      );
      setSubjects(withStats);
    } catch (error) {
      console.error('Error loading subjects:', error);
      showToast('Failed to load subjects. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setForm({ name: '', description: '' });
    setActiveSubject(null);
    setModalMode('add');
  };

  const openEdit = (s: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm({ name: s.name, description: s.description ?? '' });
    setActiveSubject(s);
    setModalMode('edit');
  };

  const openDelete = (s: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSubject(s);
    setModalMode('delete');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modalMode === 'add' && user) {
        console.log('[SubjectsPage] Creating subject with user ID:', user.id);
        await subjectsService.create(user.id, form);
        showToast('Subject created.');
      } else if (modalMode === 'edit' && activeSubject) {
        await subjectsService.update(activeSubject.id, form);
        showToast('Subject updated.');
      }
      setModalMode(null);
      await loadSubjects();
    } catch (error) {
      console.error('[SubjectsPage] Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save subject';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeSubject) return;
    setSaving(true);
    try {
      await subjectsService.delete(activeSubject.id);
      showToast('Subject deleted.');
      setModalMode(null);
      await loadSubjects();
    } catch {
      showToast('Failed to delete subject', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 800 }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">Your academic subjects and their progress.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus /> Add Subject
        </button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No subjects yet"
          description="Add your first subject to get started."
          action={
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus /> Add Subject
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {subjects.map((s) => {
            const pct = calcProgress(s.completed, s.total);
            return (
              <div
                key={s.id}
                className="card card-hover"
                onClick={() => navigate(`/subjects/${s.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/subjects/${s.id}`)}
                aria-label={`Open ${s.name}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--choco)' }}>
                        {s.name}
                      </span>
                      {pct === 100 && (
                        <span className="badge complete">✓ Complete</span>
                      )}
                    </div>
                    {s.description && (
                      <p style={{ fontSize: '0.8375rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                        {s.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.625rem' }}>
                      <span>{s.chapters} chapter{s.chapters !== 1 ? 's' : ''}</span>
                      <span>{s.completed} / {s.total} topics</span>
                    </div>
                    <ProgressBar completed={s.completed} total={s.total} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                      className="btn-icon"
                      onClick={(e) => openEdit(s, e)}
                      aria-label={`Edit ${s.name}`}
                      title="Edit"
                    >
                      <Pencil />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={(e) => openDelete(s, e)}
                      aria-label={`Delete ${s.name}`}
                      title="Delete"
                      style={{ color: 'var(--rose)' }}
                    >
                      <Trash2 />
                    </button>
                    <ChevronRight size={16} style={{ color: 'var(--text-light)', marginLeft: '0.25rem' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <Modal
          title={modalMode === 'add' ? 'New Subject' : 'Edit Subject'}
          onClose={() => setModalMode(null)}
        >
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label" htmlFor="subject-name">Subject name</label>
              <input
                id="subject-name"
                type="text"
                className="form-input"
                placeholder="e.g. Computer Graphics"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="subject-desc">Description (optional)</label>
              <textarea
                id="subject-desc"
                className="form-textarea"
                placeholder="Brief description…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ minHeight: 72 }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalMode(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : modalMode === 'add' ? 'Add Subject' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {modalMode === 'delete' && activeSubject && (
        <Modal title="Delete Subject" onClose={() => setModalMode(null)}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Are you sure you want to delete <strong>{activeSubject.name}</strong>? This will also delete all chapters, topics, and notes.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
