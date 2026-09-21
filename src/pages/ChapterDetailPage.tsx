import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Check, StickyNote, Paperclip, Download, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { subjectsService } from '../services/subjects.service';
import { chaptersService } from '../services/chapters.service';
import { topicsService } from '../services/topics.service';
import { notesService } from '../services/notes.service';
import { getChapterAttachments, uploadChapterAttachment, deleteChapterAttachment, getChapterAttachmentUrl } from '../services/chapter-attachments.service';
import { Modal } from '../components/ui/Modal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import type { Subject, Chapter, Topic, TopicFormData, ChapterAttachment } from '../types';

type ModalMode = 'add' | 'edit' | 'delete' | 'upload-chapter';

export function ChapterDetailPage() {
  const { subjectId, chapterId } = useParams<{ subjectId: string; chapterId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsWithNotes, setTopicsWithNotes] = useState<Set<string>>(new Set());
  const [chapterAttachments, setChapterAttachments] = useState<ChapterAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [form, setForm] = useState<TopicFormData>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (subjectId && chapterId) loadData();
  }, [subjectId, chapterId]);

  const loadData = async () => {
    if (!subjectId || !chapterId) return;
    setLoading(true);
    try {
      const [sub, ch, topicList, attachments] = await Promise.all([
        subjectsService.getById(subjectId),
        chaptersService.getById(chapterId),
        topicsService.getByChapter(chapterId),
        getChapterAttachments(chapterId),
      ]);
      setSubject(sub);
      setChapter(ch);
      setTopics(topicList);
      setChapterAttachments(attachments);

      // Check which topics have notes
      const notesChecks = await Promise.all(
        topicList.map(async (t) => {
          const note = await notesService.getByTopic(t.id);
          return note ? t.id : null;
        })
      );
      setTopicsWithNotes(new Set(notesChecks.filter(Boolean) as string[]));
    } catch (error) {
      console.error('Error loading chapter:', error);
      showToast('Failed to load chapter. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompletion = async (topic: Topic) => {
    const newVal = !topic.is_completed;
    // Optimistic update
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_completed: newVal } : t)));
    try {
      await topicsService.toggleCompletion(topic.id, newVal);
      showToast(newVal ? 'Topic completed.' : 'Topic marked incomplete.');
    } catch {
      // Revert
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_completed: !newVal } : t)));
      showToast('Failed to update topic', 'error');
    }
  };

  const openAdd = () => {
    console.log("SELECTED CHAPTER:", chapter);
    console.log("SELECTED CHAPTER ID:", chapter?.id);
    setForm({ name: '', description: '' });
    setActiveTopic(null);
    setModalMode('add');
  };

  const openEdit = (t: Topic, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("SELECTED CHAPTER:", chapter);
    console.log("SELECTED CHAPTER ID:", chapter?.id);
    setForm({ name: t.name, description: t.description ?? '' });
    setActiveTopic(t);
    setModalMode('edit');
  };

  const openDelete = (t: Topic, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTopic(t);
    setModalMode('delete');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !chapterId) return;
    setSaving(true);
    try {
      if (modalMode === 'add') {
        console.log('[ChapterDetailPage] Creating topic with chapter ID:', chapterId);
        await topicsService.create(chapterId, form, topics.length);
        showToast('Topic added.');
      } else if (modalMode === 'edit' && activeTopic) {
        await topicsService.update(activeTopic.id, form);
        showToast('Topic updated.');
      }
      setModalMode(null);
      await loadData();
    } catch (error) {
      console.error('[ChapterDetailPage] Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save topic';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeTopic) return;
    setSaving(true);
    try {
      await topicsService.delete(activeTopic.id);
      showToast('Topic deleted.');
      setModalMode(null);
      await loadData();
    } catch {
      showToast('Failed to delete topic', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChapterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !chapterId) return;

    setUploading(true);
    try {
      await uploadChapterAttachment(chapterId, file, user.id);
      showToast('File uploaded successfully.');
      await loadData();
      setModalMode(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload file', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleChapterFileDelete = async (attachment: ChapterAttachment) => {
    try {
      await deleteChapterAttachment(attachment.id, attachment.storage_path);
      showToast('File deleted.');
      await loadData();
    } catch {
      showToast('Failed to delete file', 'error');
    }
  };

  const handleChapterFileDownload = async (attachment: ChapterAttachment) => {
    try {
      const url = await getChapterAttachmentUrl(attachment.storage_path);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      showToast('Failed to download file', 'error');
    }
  };

  if (loading) return <LoadingState />;
  if (!chapter || !subject) return <p style={{ color: 'var(--text-muted)' }}>Chapter not found.</p>;

  const completed = topics.filter((t) => t.is_completed).length;
  const total = topics.length;

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 700 }}>
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button onClick={() => navigate('/subjects')}>Subjects</button>
        <span className="breadcrumb-sep">/</span>
        <button onClick={() => navigate(`/subjects/${subjectId}`)}>{subject.name}</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{chapter.name}</span>
      </nav>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{chapter.name}</h1>
          {chapter.description && <p className="page-subtitle">{chapter.description}</p>}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus /> Add Topic
        </button>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <ProgressBar completed={completed} total={total} showLabel />
        </div>
      )}

      {/* Chapter Attachments */}
      {chapterAttachments.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted)', margin: 0 }}>
              Chapter Attachments
            </h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setModalMode('upload-chapter')}
              style={{ fontSize: '0.8rem' }}
            >
              <Paperclip size={12} style={{ marginRight: '0.25rem' }} />
              Add File
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {chapterAttachments.map((attachment) => (
              <div
                key={attachment.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'var(--sand)',
                  fontSize: '0.85rem',
                }}
              >
                <Paperclip size={14} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attachment.file_name}
                </span>
                <button
                  className="btn-icon"
                  onClick={() => handleChapterFileDownload(attachment)}
                  title="Download"
                  style={{ padding: '0.25rem' }}
                >
                  <Download size={12} />
                </button>
                <button
                  className="btn-icon"
                  onClick={() => handleChapterFileDelete(attachment)}
                  title="Delete"
                  style={{ padding: '0.25rem', color: 'var(--rose)' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topics List */}
      {topics.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No topics yet"
          description="Add the first topic to this chapter."
          action={
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus /> Add Topic
            </button>
          }
        />
      ) : (
        <div className="card" style={{ padding: '0.5rem 1.25rem' }}>
          {topics.map((t) => (
            <div key={t.id} className="topic-row">
              {/* Checkbox */}
              <div
                className={`checkbox-wrap${t.is_completed ? ' checked' : ''}`}
                onClick={() => toggleCompletion(t)}
                role="checkbox"
                aria-checked={t.is_completed}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && toggleCompletion(t)}
                aria-label={`Mark "${t.name}" as ${t.is_completed ? 'incomplete' : 'complete'}`}
              >
                {t.is_completed && <Check />}
              </div>

              {/* Topic name — clickable to open detail */}
              <div
                className={`topic-name${t.is_completed ? ' completed' : ''}`}
                onClick={() => navigate(`/subjects/${subjectId}/chapters/${chapterId}/topics/${t.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/subjects/${subjectId}/chapters/${chapterId}/topics/${t.id}`)}
              >
                {t.name}
                {t.description && (
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                    {t.description}
                  </div>
                )}
                {/* Inline status row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {/* Status indicators removed - fields don't exist in database yet */}
                </div>
              </div>

              {/* Favorite indicator removed - field doesn't exist in database yet */}

              {/* Notes dot indicator */}
              {topicsWithNotes.has(t.id) && (
                <div className="notes-dot" title="Has notes" />
              )}

              {/* Actions */}
              <div className="topic-actions">
                <button
                  className="btn-icon"
                  onClick={() => navigate(`/subjects/${subjectId}/chapters/${chapterId}/topics/${t.id}`)}
                  aria-label={`View notes for ${t.name}`}
                  title="Notes"
                >
                  <StickyNote size={14} />
                </button>
                <button className="btn-icon" onClick={(e) => openEdit(t, e)} aria-label={`Edit ${t.name}`} title="Edit">
                  <Pencil size={13} />
                </button>
                <button className="btn-icon" onClick={(e) => openDelete(t, e)} aria-label={`Delete ${t.name}`} title="Delete" style={{ color: 'var(--rose)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <Modal title={modalMode === 'add' ? 'New Topic' : 'Edit Topic'} onClose={() => setModalMode(null)}>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label" htmlFor="topic-name">Topic name</label>
              <input
                id="topic-name"
                type="text"
                className="form-input"
                placeholder="e.g. DDA Algorithm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="topic-desc">Description (optional)</label>
              <input
                id="topic-desc"
                type="text"
                className="form-input"
                placeholder="Brief description…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : modalMode === 'add' ? 'Add Topic' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm */}
      {modalMode === 'delete' && activeTopic && (
        <Modal title="Delete Topic" onClose={() => setModalMode(null)}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Delete <strong>{activeTopic.name}</strong>? Any notes will also be removed.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* Upload Chapter Attachment Modal */}
      {modalMode === 'upload-chapter' && (
        <Modal title="Upload Chapter File" onClose={() => setModalMode(null)}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Upload files related to this chapter (PDF, images, Word, PowerPoint, text).
              Maximum file size: 10MB.
            </p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.ppt,.pptx,.txt"
              onChange={handleChapterFileUpload}
              disabled={uploading}
              style={{ width: '100%' }}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModalMode(null)} disabled={uploading}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
