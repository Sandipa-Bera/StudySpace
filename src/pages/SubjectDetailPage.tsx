import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronRight, Paperclip, Download } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { subjectsService } from '../services/subjects.service';
import { chaptersService } from '../services/chapters.service';
import { topicsService } from '../services/topics.service';
import { getChapterAttachments, uploadChapterAttachment, deleteChapterAttachment, getChapterAttachmentUrl } from '../services/chapter-attachments.service';
import { Modal } from '../components/ui/Modal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { calcProgress } from '../utils/progress';
import type { Subject, Chapter, ChapterFormData, Topic, TopicFormData, ChapterAttachment } from '../types';
import { Check } from 'lucide-react';

interface ChapterWithStats extends Chapter {
  total: number;
  completed: number;
  topics: Topic[];
  attachments: ChapterAttachment[];
  isExpanded?: boolean;
}

type ModalMode = 'add' | 'edit' | 'delete' | 'add-topic' | 'upload-chapter' | 'delete-topic';

export function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<ChapterWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [form, setForm] = useState<ChapterFormData>({ name: '', description: '' });
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [topicForm, setTopicForm] = useState<TopicFormData>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (subjectId) loadData();
  }, [subjectId]);

  const loadData = async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const [sub, rawChapters] = await Promise.all([
        subjectsService.getById(subjectId),
        chaptersService.getBySubject(subjectId),
      ]);
      setSubject(sub);

      const withStats: ChapterWithStats[] = await Promise.all(
        rawChapters.map(async (ch) => {
          const [topicList, attachmentList] = await Promise.all([
            topicsService.getByChapter(ch.id),
            getChapterAttachments(ch.id)
          ]);
          return {
            ...ch,
            total: topicList.length,
            completed: topicList.filter((t) => t.is_completed).length,
            topics: topicList,
            attachments: attachmentList,
            isExpanded: false
          };
        })
      );
      setChapters(withStats);
    } catch (error) {
      console.error('Error loading subject details:', error);
      showToast('Failed to load subject. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setForm({ name: '', description: '' });
    setActiveChapter(null);
    setModalMode('add');
  };

  const openEdit = (ch: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm({ name: ch.name, description: ch.description ?? '' });
    setActiveChapter(ch);
    setModalMode('edit');
  };

  const openDelete = (ch: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveChapter(ch);
    setModalMode('delete');
  };

  const toggleExpand = (chapterId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setChapters(prev => prev.map(ch => ch.id === chapterId ? { ...ch, isExpanded: !ch.isExpanded } : ch));
  };

  const openAddTopic = (ch: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveChapter(ch);
    setTopicForm({ name: '', description: '' });
    setModalMode('add-topic');
  };

  const openDeleteTopic = (topic: Topic, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTopic(topic);
    setModalMode('delete-topic');
  };

  const openUploadChapter = (ch: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveChapter(ch);
    setModalMode('upload-chapter');
  };

  const toggleTopicCompletion = async (topic: Topic, chapterId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const newVal = !topic.is_completed;
    
    // Optimistic update
    setChapters(prev => prev.map(ch => {
      if (ch.id === chapterId) {
        const newTopics = ch.topics.map(t => t.id === topic.id ? { ...t, is_completed: newVal } : t);
        return {
          ...ch,
          topics: newTopics,
          completed: newTopics.filter(t => t.is_completed).length
        };
      }
      return ch;
    }));
    
    try {
      await topicsService.toggleCompletion(topic.id, newVal);
    } catch {
      await loadData();
      showToast('Failed to update topic', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !subjectId) return;
    setSaving(true);
    try {
      if (modalMode === 'add') {
        await chaptersService.create(subjectId, form, chapters.length);
        showToast('Chapter added.');
      } else if (modalMode === 'edit' && activeChapter) {
        await chaptersService.update(activeChapter.id, form);
        showToast('Chapter updated.');
      }
      setModalMode(null);
      await loadData();
    } catch (error) {
      console.error('[SubjectDetailPage] Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save chapter';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.name.trim() || !activeChapter) return;
    setSaving(true);
    try {
      const currentChapter = chapters.find(c => c.id === activeChapter.id);
      const orderIndex = currentChapter ? currentChapter.topics.length : 0;
      await topicsService.create(activeChapter.id, topicForm, orderIndex);
      showToast('Topic added.');
      setModalMode(null);
      await loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save topic';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeChapter) return;
    setSaving(true);
    try {
      await chaptersService.delete(activeChapter.id);
      showToast('Chapter deleted.');
      setModalMode(null);
      await loadData();
    } catch {
      showToast('Failed to delete chapter', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async () => {
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
    if (!file || !user || !activeChapter) return;

    setUploading(true);
    try {
      await uploadChapterAttachment(activeChapter.id, file, user.id);
      showToast('File uploaded successfully.');
      setModalMode(null);
      await loadData();
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
  if (!subject) return <p style={{ color: 'var(--text-muted)' }}>Subject not found.</p>;

  const totalTopics = chapters.reduce((sum, ch) => sum + ch.total, 0);
  const completedTopics = chapters.reduce((sum, ch) => sum + ch.completed, 0);

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 720 }}>
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button onClick={() => navigate('/subjects')}>Subjects</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{subject.name}</span>
      </nav>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{subject.name}</h1>
          {subject.description && (
            <p className="page-subtitle">{subject.description}</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus /> Add Chapter
        </button>
      </div>

      {/* Progress summary */}
      {totalTopics > 0 && (
        <div className="card" style={{ marginBottom: '1.75rem' }}>
          <ProgressBar completed={completedTopics} total={totalTopics} showLabel />
        </div>
      )}

      {/* Chapters */}
      {chapters.length === 0 ? (
        <EmptyState
          icon="📖"
          title="No chapters yet"
          description="Add the first chapter to this subject."
          action={
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus /> Add Chapter
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {chapters.map((ch, idx) => {
            const pct = calcProgress(ch.completed, ch.total);
            return (
              <div key={ch.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div
                  className="card card-hover"
                  onClick={(e) => toggleExpand(ch.id, e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleExpand(ch.id, e)}
                  aria-label={`Toggle ${ch.name}`}
                  style={{ marginBottom: 0 }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.775rem', color: 'var(--text-light)', fontWeight: 500, flexShrink: 0 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--choco)' }}>
                          {ch.name}
                        </span>
                        {pct === 100 && ch.total > 0 && (
                          <span className="badge complete" style={{ fontSize: '0.7rem' }}>✓</span>
                        )}
                      </div>
                      {ch.description && (
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0 0 0.5rem', paddingLeft: '1.625rem' }}>
                          {ch.description}
                        </p>
                      )}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', paddingLeft: '1.625rem', marginBottom: '0.5rem' }}>
                        {ch.completed} / {ch.total} topics
                      </div>
                      {ch.total > 0 && (
                        <div style={{ paddingLeft: '1.625rem' }}>
                          <ProgressBar completed={ch.completed} total={ch.total} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                      <button className="btn-icon" onClick={(e) => openEdit(ch, e)} aria-label={`Edit ${ch.name}`} title="Edit">
                        <Pencil />
                      </button>
                      <button className="btn-icon" onClick={(e) => openDelete(ch, e)} aria-label={`Delete ${ch.name}`} title="Delete" style={{ color: 'var(--rose)' }}>
                        <Trash2 />
                      </button>
                      <div style={{ transform: ch.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', marginLeft: '0.25rem' }}>
                        <ChevronRight size={16} style={{ color: 'var(--text-light)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Topics Accordion Content */}
                {ch.isExpanded && (
                  <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', animation: 'fadeIn 0.2s ease', marginBottom: '0.5rem' }}>
                    {ch.attachments && ch.attachments.length > 0 && (
                      <div style={{ marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {ch.attachments.map(attachment => (
                          <div
                            key={attachment.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.375rem 0.75rem',
                              borderRadius: '6px',
                              background: 'var(--card-bg)',
                              border: '1px solid var(--border)',
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
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {ch.topics.map(t => (
                      <div key={t.id} className="topic-row" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div
                          className={`checkbox-wrap${t.is_completed ? ' checked' : ''}`}
                          onClick={(e) => toggleTopicCompletion(t, ch.id, e)}
                          role="checkbox"
                          aria-checked={t.is_completed}
                          tabIndex={0}
                          onKeyDown={(e) => e.key === ' ' && toggleTopicCompletion(t, ch.id, e)}
                        >
                          {t.is_completed && <Check size={14} />}
                        </div>
                        <div
                          className={`topic-name${t.is_completed ? ' completed' : ''}`}
                          onClick={() => navigate(`/subjects/${subjectId}/chapters/${ch.id}/topics/${t.id}`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && navigate(`/subjects/${subjectId}/chapters/${ch.id}/topics/${t.id}`)}
                          style={{ flex: 1, fontSize: '0.9rem' }}
                        >
                          {t.name}
                        </div>
                        <div className="topic-actions">
                          <button 
                            className="btn-icon" 
                            onClick={(e) => openDeleteTopic(t, e)} 
                            aria-label={`Delete ${t.name}`} 
                            title="Delete Topic" 
                            style={{ color: 'var(--rose)', padding: '0.25rem' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={(e) => openAddTopic(ch, e)}
                        style={{ fontSize: '0.8rem' }}
                      >
                        <Plus size={14} style={{ marginRight: '0.25rem' }} /> Add Topic
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={(e) => openUploadChapter(ch, e)}
                        style={{ fontSize: '0.8rem' }}
                      >
                        <Paperclip size={14} style={{ marginRight: '0.25rem' }} /> Add File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Chapter Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <Modal title={modalMode === 'add' ? 'New Chapter' : 'Edit Chapter'} onClose={() => setModalMode(null)}>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label" htmlFor="chapter-name">Chapter name</label>
              <input
                id="chapter-name"
                type="text"
                className="form-input"
                placeholder="e.g. Scan Conversion"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="chapter-desc">Description (optional)</label>
              <textarea
                id="chapter-desc"
                className="form-textarea"
                placeholder="Brief description…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ minHeight: 64 }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : modalMode === 'add' ? 'Add Chapter' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Topic Modal */}
      {modalMode === 'add-topic' && activeChapter && (
        <Modal title="New Topic" onClose={() => setModalMode(null)}>
          <form onSubmit={handleSaveTopic}>
            <div className="form-group">
              <label className="form-label" htmlFor="topic-name">Topic name</label>
              <input
                id="topic-name"
                type="text"
                className="form-input"
                placeholder="e.g. Scan Conversion"
                value={topicForm.name}
                onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="topic-desc">Description (optional)</label>
              <textarea
                id="topic-desc"
                className="form-textarea"
                placeholder="Brief description…"
                value={topicForm.description}
                onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                style={{ minHeight: 64 }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !topicForm.name.trim()}>
                {saving ? 'Saving…' : 'Add Topic'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Topic Confirm */}
      {modalMode === 'delete-topic' && activeTopic && (
        <Modal title="Delete Topic" onClose={() => setModalMode(null)}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Delete <strong>{activeTopic.name}</strong>? Any notes will also be removed.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDeleteTopic} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* Upload Chapter Attachment Modal */}
      {modalMode === 'upload-chapter' && activeChapter && (
        <Modal title="Upload Chapter File" onClose={() => setModalMode(null)}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Upload files related to <strong>{activeChapter.name}</strong> (PDF, images, Word, PowerPoint, text).
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

      {/* Delete Confirm */}
      {modalMode === 'delete' && activeChapter && (
        <Modal title="Delete Chapter" onClose={() => setModalMode(null)}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Delete <strong>{activeChapter.name}</strong>? All topics and notes will be removed.
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
