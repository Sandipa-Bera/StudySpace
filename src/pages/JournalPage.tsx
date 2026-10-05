import React, { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Calendar, List, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { journalService } from '../services/journal.service';
import { Modal } from '../components/ui/Modal';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { formatEntryDate, formatShortDate, todayISO } from '../utils/date';
import type { JournalEntry, JournalFormData } from '../types';

/* ─── Mood definitions ──────────────────────────────────────── */
const MOODS = [
  { emoji: '😭', label: 'Not Okay', key: 'not_okay' },
  { emoji: '😔', label: 'Heavy Heart', key: 'heavy_heart' },
  { emoji: '😡', label: 'Angry', key: 'angry' },
  { emoji: '😵‍💫', label: 'Too Much', key: 'too_much' },
  { emoji: '🫠', label: 'Exhausted', key: 'exhausted' },
  { emoji: '😐', label: 'Numb', key: 'numb' },
  { emoji: '😌', label: 'At Peace', key: 'at_peace' },
  { emoji: '😊', label: 'Happy', key: 'happy' },
  { emoji: '🥰', label: 'Loved', key: 'loved' },
  { emoji: '🤩', label: 'Excited', key: 'excited' },
  { emoji: '🫶', label: 'Grateful', key: 'grateful' },
  { emoji: '🤭', label: 'Silly', key: 'silly' },
];

/** Get the mood object from an entry's stored mood or sticker */
function getMoodFromEntry(entry: JournalEntry) {
  // Try matching by key first (new system)
  const byKey = MOODS.find(m => m.key === entry.mood);
  if (byKey) return byKey;
  // Try matching by label (fallback)
  const byLabel = MOODS.find(m => m.label.toLowerCase() === (entry.mood ?? '').toLowerCase());
  if (byLabel) return byLabel;
  // Try matching old sticker as emoji
  const byEmoji = MOODS.find(m => m.emoji === entry.sticker);
  if (byEmoji) return byEmoji;
  // Fallback for old moods that don't match new system
  if (entry.mood) {
    return { emoji: '📝', label: entry.mood, key: entry.mood.toLowerCase() };
  }
  if (entry.sticker) {
    return { emoji: entry.sticker, label: '', key: '' };
  }
  return null;
}

const DEFAULT_FORM: JournalFormData = {
  title: '',
  content: '',
  mood: '',
  sticker: '',
  photo_url: '',
  entry_date: todayISO(),
};

type PageView = 'list' | 'calendar' | 'new' | 'edit' | 'detail' | 'date-entries';

export function JournalPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<JournalFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [pageView, setPageView] = useState<PageView>('list');
  const [listMode, setListMode] = useState<'timeline' | 'calendar'>('timeline');
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateEntries, setSelectedDateEntries] = useState<JournalEntry[]>([]);
  const [selectedDateLabel, setSelectedDateLabel] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await journalService.getAll(user.id);
      setEntries(data);
    } catch (err) {
      console.error('[JournalPage] loadEntries failed:', err);
      showToast('Failed to load journal', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadEntries();
    } else {
      // User is guaranteed by ProtectedRoute, but guard defensively
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ─── Navigation helpers ──────────────────────────────────── */
  const goToNew = () => {
    setForm({ ...DEFAULT_FORM, entry_date: todayISO() });
    setEditEntry(null);
    setPageView('new');
  };

  const goToEdit = (entry: JournalEntry) => {
    const mood = getMoodFromEntry(entry);
    setForm({
      title: entry.title || '',
      content: entry.content || '',
      mood: mood?.key || '',
      sticker: mood?.emoji || entry.sticker || '',
      photo_url: entry.photo_url || '',
      entry_date: entry.entry_date,
    });
    setEditEntry(entry);
    setPageView('edit');
  };

  const goToDetail = (entry: JournalEntry) => {
    setViewEntry(entry);
    setPageView('detail');
  };

  const goBack = () => {
    setPageView('list');
    setViewEntry(null);
    setEditEntry(null);
    setSelectedDateEntries([]);
    setSelectedDateLabel('');
  };

  const goBackToDate = () => {
    setPageView('date-entries');
    setViewEntry(null);
    setEditEntry(null);
  };

  /* ─── Form handlers ──────────────────────────────────────── */
  const selectMood = (moodKey: string, moodEmoji: string) => {
    if (form.mood === moodKey) {
      setForm({ ...form, mood: '', sticker: '' });
    } else {
      setForm({ ...form, mood: moodKey, sticker: moodEmoji });
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be smaller than 5MB', 'error');
      return;
    }
    // Validate type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm({ ...form, photo_url: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setForm({ ...form, photo_url: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.content.trim() && !form.mood) {
      showToast('Write something or select a mood first', 'error');
      return;
    }
    setSaving(true);
    try {
      if (pageView === 'new') {
        await journalService.create(user.id, form);
        showToast('Journal entry saved ✨');
      } else if (pageView === 'edit' && editEntry) {
        await journalService.update(editEntry.id, form);
        showToast('Entry updated ✨');
      }
      await loadEntries();
      goBack();
    } catch {
      showToast('Failed to save entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await journalService.delete(deleteTarget.id);
      showToast('Entry deleted.');
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      await loadEntries();
      if (pageView === 'detail') {
        // If we came from date-entries, go back there with updated list
        if (selectedDateEntries.length > 0) {
          const remaining = selectedDateEntries.filter(e => e.id !== deletedId);
          if (remaining.length === 0) {
            goBack();
          } else {
            setSelectedDateEntries(remaining);
            goBackToDate();
          }
        } else {
          goBack();
        }
      } else if (pageView === 'date-entries') {
        // Update the list inline; if empty go back
        const remaining = selectedDateEntries.filter(e => e.id !== deletedId);
        if (remaining.length === 0) {
          goBack();
        } else {
          setSelectedDateEntries(remaining);
        }
      }
    } catch {
      showToast('Failed to delete entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Calendar helpers ──────────────────────────────────── */
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const getEntriesForDate = (date: Date) => {
    // Use local year/month/day to avoid UTC timezone offset issues
    // (toISOString() converts to UTC which can shift the date by a day for IST users)
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return entries.filter(entry => entry.entry_date === dateStr);
  };

  const goToDateEntries = (date: Date) => {
    const dateEntries = getEntriesForDate(date);
    if (dateEntries.length === 0) return;
    const label = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    setSelectedDateEntries(dateEntries);
    setSelectedDateLabel(label);
    setPageView('date-entries');
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') newDate.setMonth(newDate.getMonth() - 1);
      else newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  /* ─── Formatted date for display ──────────────────────── */
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  /* ─── Render helpers ───────────────────────────────────── */
  const renderEntryCard = (entry: JournalEntry) => {
    const mood = getMoodFromEntry(entry);
    return (
      <div
        key={entry.id}
        className="journal-entry-card"
        onClick={() => goToDetail(entry)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && goToDetail(entry)}
        aria-label={`Open journal entry: ${entry.title || 'Untitled'}`}
      >
        {/* Mood emoji */}
        <div className="journal-card-mood">
          {mood?.emoji || '📝'}
        </div>

        {/* Body */}
        <div className="journal-card-body">
          <div className="journal-card-meta">
            <span className="journal-date">{formatShortDate(entry.entry_date)}</span>
            {mood?.label && (
              <span className="journal-mood-label">{mood.label}</span>
            )}
          </div>
          {entry.title && (
            <h3 className="journal-title">{entry.title}</h3>
          )}
          {entry.content && (
            <p className="journal-preview">{entry.content}</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0, alignSelf: 'flex-start' }}>
          <button
            className="btn-icon"
            onClick={(e) => { e.stopPropagation(); goToEdit(entry); }}
            aria-label="Edit"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry); }}
            aria-label="Delete"
            title="Delete"
            style={{ color: 'var(--error)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingState />;

  /* ═══════════════════════════════════════════════════════════
     NEW / EDIT — Full-page journal editor
     ═══════════════════════════════════════════════════════════ */
  if (pageView === 'new' || pageView === 'edit') {
    const isEdit = pageView === 'edit';
    return (
      <div className="journal-editor">
        {/* Header */}
        <div className="journal-detail-nav">
          <button className="btn btn-ghost btn-sm" onClick={goBack}>
            ← Back
          </button>
          <h1
            style={{
              fontFamily: 'Lora, serif',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--primary)',
              margin: 0,
            }}
          >
            {isEdit ? 'Edit Entry' : 'New Entry'}
          </h1>
        </div>

        {/* Date */}
        <div className="journal-editor-header">
          <div className="journal-editor-date">
            📅 {isEdit ? formatEntryDate(form.entry_date) : todayFormatted}
          </div>

          {/* Title (optional) */}
          <input
            type="text"
            className="journal-editor-title-input"
            placeholder="Give this entry a title (optional)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus={!isEdit}
          />
        </div>

        {/* Mood selector */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div className="journal-section-label">
            💭 How are you feeling today?
          </div>
          <div className="mood-selector">
            {MOODS.map((mood) => (
              <button
                key={mood.key}
                type="button"
                className={`mood-option${form.mood === mood.key ? ' selected' : ''}`}
                onClick={() => selectMood(mood.key, mood.emoji)}
                aria-label={`Select mood: ${mood.label}`}
                aria-pressed={form.mood === mood.key}
              >
                <span className="mood-emoji">{mood.emoji}</span>
                <span className="mood-label">{mood.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Writing area */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div className="journal-section-label">
            ✍️ What's on your mind?
          </div>
          <textarea
            className="journal-textarea"
            placeholder="Write whatever you want. There are no rules here."
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
        </div>

        {/* Photo attachment */}
        <div style={{ marginBottom: '1rem' }}>
          <div className="journal-section-label">
            📷 Add a photo
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoSelect}
          />
          {form.photo_url ? (
            <div className="journal-photo-preview">
              <img src={form.photo_url} alt="Attached photo" />
              <button
                className="photo-remove-btn"
                onClick={removePhoto}
                aria-label="Remove photo"
                title="Remove photo"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              className="journal-photo-zone"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <div className="journal-photo-zone-label">
                <span className="photo-icon">📸</span>
                <span>Click to attach a photo (optional)</span>
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="journal-save-area">
          <button className="btn btn-ghost" onClick={goBack}>
            Cancel
          </button>
          <button
            className="btn-save-entry"
            onClick={handleSave}
            disabled={saving || (!form.content.trim() && !form.mood)}
          >
            {saving ? 'Saving…' : isEdit ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     DETAIL — View a single journal entry
     ═══════════════════════════════════════════════════════════ */
  if (pageView === 'detail' && viewEntry) {
    const mood = getMoodFromEntry(viewEntry);
    const backFromDetail = selectedDateEntries.length > 0 ? goBackToDate : goBack;
    return (
      <div className="journal-detail">
        <div className="journal-detail-nav">
          <button className="btn btn-ghost btn-sm" onClick={backFromDetail}>
            ← Back
          </button>
          <div className="journal-detail-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => goToEdit(viewEntry)}
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--error)' }}
              onClick={() => setDeleteTarget(viewEntry)}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>

        <div className="journal-detail-card">
          {/* Date */}
          <div className="journal-detail-date">
            {formatEntryDate(viewEntry.entry_date)}
          </div>

          {/* Mood */}
          {mood && (
            <div className="journal-detail-mood">
              <span className="journal-detail-mood-emoji">{mood.emoji}</span>
              {mood.label && (
                <span className="journal-detail-mood-name">{mood.label}</span>
              )}
            </div>
          )}

          {/* Title */}
          {viewEntry.title && (
            <h1 className="journal-detail-title">{viewEntry.title}</h1>
          )}

          {/* Content */}
          <div className="journal-detail-content">
            {viewEntry.content || (
              <em style={{ color: 'var(--text-light)' }}>No content written.</em>
            )}
          </div>

          {/* Photo */}
          {viewEntry.photo_url && (
            <div className="journal-detail-photo">
              <img src={viewEntry.photo_url} alt="Journal photo" />
            </div>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deleteTarget && (
          <Modal title="Delete Entry" onClose={() => setDeleteTarget(null)}>
            <div className="journal-delete-warning">
              <div className="delete-emoji">🗑️</div>
              <p>
                Are you sure you want to delete this journal entry?
                <br />
                <strong>This cannot be undone.</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     DATE ENTRIES — All entries for a selected calendar date
     ═══════════════════════════════════════════════════════════ */
  if (pageView === 'date-entries') {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 680 }}>
        {/* Header */}
        <div className="journal-detail-nav" style={{ marginBottom: '1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={goBack}>
            ← Back
          </button>
          <button className="btn btn-primary btn-sm" onClick={goToNew}>
            <Plus size={14} /> New Entry
          </button>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <h1
            style={{
              fontFamily: 'Lora, serif',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--primary)',
              margin: 0,
            }}
          >
            📅 {selectedDateLabel}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            {selectedDateEntries.length} {selectedDateEntries.length === 1 ? 'entry' : 'entries'} on this day
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {selectedDateEntries.map(renderEntryCard)}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <Modal title="Delete Entry" onClose={() => setDeleteTarget(null)}>
            <div className="journal-delete-warning">
              <div className="delete-emoji">🗑️</div>
              <p>
                Are you sure you want to delete this journal entry?
                {deleteTarget.title && (
                  <>
                    <br />
                    <strong>"{deleteTarget.title}"</strong>
                  </>
                )}
                <br />
                <span style={{ fontSize: '0.8rem' }}>This cannot be undone.</span>
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     LIST / CALENDAR — Main journal view
     ═══════════════════════════════════════════════════════════ */
  const renderCalendar = () => {
    const days = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigateMonth('prev')}>
            <ChevronLeft size={16} />
          </button>
          <h2 style={{ fontSize: '1.1rem', fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
            {monthName}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigateMonth('next')}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.5rem' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
          {days.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} style={{ aspectRatio: 1 }} />;

            const dateEntries = getEntriesForDate(date);
            const hasEntries = dateEntries.length > 0;
            const isToday = date.toDateString() === new Date().toDateString();
            // Show mood from the first entry; if multiple, show a stack indicator
            const firstMood = dateEntries.length > 0 ? getMoodFromEntry(dateEntries[0]) : null;
            const hasMultiple = dateEntries.length > 1;

            const classes = [
              'journal-cal-cell',
              hasEntries ? 'has-entry' : '',
              isToday ? 'is-today' : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={date.toISOString()}
                className={classes}
                onClick={() => goToDateEntries(date)}
                disabled={!hasEntries}
                style={{
                  fontWeight: isToday ? 700 : 400,
                  position: 'relative',
                }}
              >
                {date.getDate()}
                {firstMood && (
                  <span className="cal-mood-dot">{firstMood.emoji}</span>
                )}
                {hasMultiple && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      fontSize: '0.55rem',
                      background: 'var(--accent)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    title={`${dateEntries.length} entries`}
                  >
                    {dateEntries.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 680 }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Journal</h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            You don't have to pretend you're okay here.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.25rem' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setListMode('timeline')}
              style={{
                background: listMode === 'timeline' ? 'var(--accent)' : 'transparent',
                color: listMode === 'timeline' ? '#fff' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '0.375rem 0.75rem',
              }}
              aria-label="Timeline view"
            >
              <List size={14} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setListMode('calendar')}
              style={{
                background: listMode === 'calendar' ? 'var(--accent)' : 'transparent',
                color: listMode === 'calendar' ? '#fff' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '0.375rem 0.75rem',
              }}
              aria-label="Calendar view"
            >
              <Calendar size={14} />
            </button>
          </div>
          <button className="btn btn-primary" onClick={goToNew}>
            <Plus /> New Entry
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Your journal is empty"
          description="Start writing about your day. No rules, no judgment."
          action={
            <button className="btn btn-primary" onClick={goToNew}>
              <Plus /> New Entry
            </button>
          }
        />
      ) : listMode === 'timeline' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(renderEntryCard)}
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          {renderCalendar()}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal title="Delete Entry" onClose={() => setDeleteTarget(null)}>
          <div className="journal-delete-warning">
            <div className="delete-emoji">🗑️</div>
            <p>
              Are you sure you want to delete this journal entry?
              {deleteTarget.title && (
                <>
                  <br />
                  <strong>"{deleteTarget.title}"</strong>
                </>
              )}
              <br />
              <span style={{ fontSize: '0.8rem' }}>This cannot be undone.</span>
            </p>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
