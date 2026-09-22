import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Pencil, Eye, EyeOff, Trash2, Clock, Upload, Play, Pause, FileText, Download, Brain, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { subjectsService } from '../services/subjects.service';
import { chaptersService } from '../services/chapters.service';
import { topicsService } from '../services/topics.service';
import { notesService } from '../services/notes.service';
import { getTopicAttachments, uploadAttachment, deleteAttachment, getAttachmentUrl } from '../services/attachments.service';
import { startStudySession, endStudySession, getTopicStudySessions, getActiveStudySession } from '../services/studySessions.service';
import { LoadingState } from '../components/ui/LoadingState';
import type { Subject, Chapter, Topic, TopicNote, TopicAttachment, StudySession } from '../types';

export function TopicDetailPage() {
  const { subjectId, chapterId, topicId } = useParams<{
    subjectId: string;
    chapterId: string;
    topicId: string;
  }>();
  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [note, setNote] = useState<TopicNote | null>(null);
  const [attachments, setAttachments] = useState<TopicAttachment[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes editor state
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // New feature states
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sessionTime, setSessionTime] = useState(0);

  useEffect(() => {
    if (subjectId && chapterId && topicId) loadData();
  }, [subjectId, chapterId, topicId]);

  useEffect(() => {
    if (user) checkActiveSession();
  }, [user]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeSession && !activeSession.ended_at) {
      interval = setInterval(() => {
        const started = new Date(activeSession.started_at).getTime();
        const now = Date.now();
        setSessionTime(Math.floor((now - started) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadData = async () => {
    if (!subjectId || !chapterId || !topicId) return;
    setLoading(true);
    try {
      const [sub, ch, tp, nt, att, sessions] = await Promise.all([
        subjectsService.getById(subjectId),
        chaptersService.getById(chapterId),
        topicsService.getById(topicId),
        notesService.getByTopic(topicId),
        getTopicAttachments(topicId),
        getTopicStudySessions(topicId),
      ]);
      setSubject(sub);
      setChapter(ch);
      setTopic(tp);
      setNote(nt);
      setNoteContent(nt?.content ?? '');
      setAttachments(att);
      setStudySessions(sessions);
    } catch {
      showToast('Failed to load topic', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveSession = async () => {
    if (!user) return;
    try {
      const session = await getActiveStudySession(user.id);
      if (session && session.topic_id === topicId) {
        setActiveSession(session);
      }
    } catch {
      // Ignore error
    }
  };

  const handleToggleCompletion = async () => {
    if (!topic) return;
    try {
      const updated = await topicsService.toggleCompletion(topic.id, !topic.is_completed, user?.id);
      setTopic(updated);
      showToast(updated.is_completed ? 'Topic completed!' : 'Topic marked as incomplete');
    } catch {
      showToast('Failed to update completion status', 'error');
    }
  };

  const handleUnderstandingStatus = async (status: 'understood' | 'need_revision' | 'dont_understand' | 'none') => {
    if (!topic) return;
    try {
      const updated = await topicsService.updateUnderstandingStatus(topic.id, status, user?.id);
      setTopic(updated);
      showToast('Understanding status updated');
    } catch {
      showToast('Failed to update understanding status', 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!topicId) return;
    setSaving(true);
    try {
      await notesService.upsert(topicId, noteContent, user?.id, topic?.name);
      setNoteContent(noteContent);
      setEditing(false);
      showToast('Notes saved.');
      await loadData();
    } catch {
      showToast('Failed to save notes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!topicId) return;
    setDeleting(true);
    try {
      await notesService.delete(topicId, user?.id, topic?.name);
      setNoteContent('');
      setNote(null);
      showToast('Notes deleted.');
      await loadData();
    } catch {
      showToast('Failed to delete notes', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleStartSession = async () => {
    if (!topic || !user) return;
    try {
      const session = await startStudySession(user.id, topic.id, topic.name);
      setActiveSession(session);
      showToast('Study session started');
    } catch {
      showToast('Failed to start session', 'error');
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await endStudySession(activeSession.id, user?.id, topic?.name);
      setActiveSession(null);
      setSessionTime(0);
      showToast('Study session ended');
      await loadData();
    } catch {
      showToast('Failed to end session', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !topic || !user) return;

    setUploadingFile(true);
    try {
      await uploadAttachment(topic.id, file, user.id);
      const updatedAttachments = await getTopicAttachments(topic.id);
      setAttachments(updatedAttachments);
      showToast('File uploaded successfully');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload file', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, storagePath: string) => {
    try {
      await deleteAttachment(attachmentId, storagePath);
      const updatedAttachments = await getTopicAttachments(topicId!);
      setAttachments(updatedAttachments);
      showToast('File deleted');
    } catch {
      showToast('Failed to delete file', 'error');
    }
  };

  const handleDownloadAttachment = async (storagePath: string, fileName: string) => {
    try {
      const url = await getAttachmentUrl(storagePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      showToast('Failed to download file', 'error');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <LoadingState />;
  if (!topic || !chapter || !subject) return <p style={{ color: 'var(--text-muted)' }}>Topic not found.</p>;

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 800 }}>
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button onClick={() => navigate('/subjects')}>Subjects</button>
        <span className="breadcrumb-sep">/</span>
        <button onClick={() => navigate(`/subjects/${subjectId}`)}>{subject.name}</button>
        <span className="breadcrumb-sep">/</span>
        <button onClick={() => navigate(`/subjects/${subjectId}/chapters/${chapterId}`)}>{chapter.name}</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{topic.name}</span>
      </nav>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">{topic.name}</h1>
          {topic.description && <p className="page-subtitle">{topic.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            className="btn btn-ghost"
            onClick={handleToggleCompletion}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: topic.is_completed ? '#F0EAE0' : 'var(--parchment)',
              color: topic.is_completed ? 'var(--brown)' : 'var(--muted)',
              border: '1px solid var(--border)',
            }}
          >
            {topic.is_completed ? (
              <><Check size={12} /> Completed</>
            ) : (
              'Not completed'
            )}
          </button>
        </div>
      </div>
      
      {/* Understanding Status */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => handleUnderstandingStatus(topic.understanding_status === 'understood' ? 'none' : 'understood')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            border: topic.understanding_status === 'understood' ? '1px solid #6B8E23' : '1px solid var(--border)',
            background: topic.understanding_status === 'understood' ? '#eef5e1' : 'var(--card-bg)',
            color: topic.understanding_status === 'understood' ? '#4d6915' : 'var(--text-main)',
            transition: 'all 0.1s',
          }}
        >
          <Brain size={14} /> Understood
        </button>
        <button
          onClick={() => handleUnderstandingStatus(topic.understanding_status === 'need_revision' ? 'none' : 'need_revision')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            border: topic.understanding_status === 'need_revision' ? '1px solid #DAA520' : '1px solid var(--border)',
            background: topic.understanding_status === 'need_revision' ? '#fff9e6' : 'var(--card-bg)',
            color: topic.understanding_status === 'need_revision' ? '#997415' : 'var(--text-main)',
            transition: 'all 0.1s',
          }}
        >
          <AlertCircle size={14} /> Needs Revision
        </button>
      </div>

      {/* Study session */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={16} style={{ color: 'var(--warm)' }} />
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>
              {activeSession ? `Studying for ${formatTime(sessionTime)}` : 'Start a study session'}
            </div>
          </div>
        </div>
        <button
          className={activeSession ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={activeSession ? handleEndSession : handleStartSession}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {activeSession ? (
            <><Pause size={14} /> End Session</>
          ) : (
            <><Play size={14} /> Start Session</>
          )}
        </button>
      </div>

      {/* Notes */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--choco)', margin: 0 }}>
            Notes
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {editing ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setPreview(!preview)}>
                  {preview ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleSaveNote} disabled={saving || !noteContent.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {note && (
                  <button className="btn btn-ghost btn-sm" onClick={handleDeleteNote} disabled={deleting} style={{ color: 'var(--rose)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          preview ? (
            <div style={{ padding: '1rem', background: 'var(--sand)', borderRadius: '8px', minHeight: 120 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              className="form-textarea"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add your notes here…"
              style={{ minHeight: 200, fontFamily: 'Inter, sans-serif' }}
            />
          )
        ) : note ? (
          <div style={{ padding: '1rem', background: 'var(--sand)', borderRadius: '8px', minHeight: 120 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>
            No notes yet. Click the edit button to add notes.
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--choco)', margin: 0 }}>
            Attachments
          </h2>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={14} style={{ marginRight: '0.25rem' }} />
            Upload
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploadingFile}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {attachments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>
            No attachments yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="card"
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <FileText size={16} style={{ color: 'var(--warm)', flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {attachment.file_name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button
                    className="btn-icon"
                    onClick={() => handleDownloadAttachment(attachment.storage_path, attachment.file_name)}
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleDeleteAttachment(attachment.id, attachment.storage_path)}
                    title="Delete"
                    style={{ color: 'var(--rose)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Markdown help */}
      {editing && !preview && (
        <div style={{ padding: '1rem', background: 'var(--sand)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0 }}>
            <strong>Markdown supported</strong> — use **bold**, *italic*, `code`, ## headings, - lists
          </p>
        </div>
      )}

      {/* Study sessions history */}
      {studySessions.length > 0 && (
        <>
          <div className="divider" />
          <div>
            <h2 style={{ fontSize: '1.05rem', fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--choco)', margin: '0 0 1rem' }}>
              Study Sessions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {studySessions.map((session) => (
                <div
                  key={session.id}
                  className="card"
                  style={{
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Clock size={16} style={{ color: 'var(--warm)' }} />
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>
                        {session.duration_seconds
                          ? `${Math.floor(session.duration_seconds / 60)} minutes`
                          : 'In progress'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        {new Date(session.started_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
