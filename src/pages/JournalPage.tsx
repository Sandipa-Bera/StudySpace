import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Calendar, List, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { journalService } from '../services/journal.service';
import { Modal } from '../components/ui/Modal';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { formatEntryDate, todayISO } from '../utils/date';
import type { JournalEntry, JournalFormData } from '../types';

const STICKERS = ['🌸', '☕', '🌙', '🐻', '🍓', '⭐', '🌱', '🌷', '📖', '✏️'];

const MOODS = ['Great', 'Good', 'Okay', 'Tired', 'Rough'];

const PROMPTS = [
  "What did you learn today?",
  "What are you proud of today?",
  "What was difficult today?",
  "What do you want to improve tomorrow?",
  "How are you feeling about your progress?",
];

const DEFAULT_FORM: JournalFormData = {
  title: '',
  content: '',
  mood: '',
  sticker: '',
  entry_date: todayISO(),
};

type ViewMode = 'timeline' | 'calendar';

export function JournalPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [form, setForm] = useState<JournalFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (user) loadEntries();
  }, [user]);

  const loadEntries = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await journalService.getAll(user.id);
      setEntries(data);
    } catch {
      showToast('Failed to load journal', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    const randomPrompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    setForm({ ...DEFAULT_FORM, entry_date: todayISO(), content: randomPrompt });
    setSelected(null);
    setModalMode('add');
    setShowPrompt(true);
  };

  const openEdit = (e: JournalEntry, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setForm({
      title: e.title,
      content: e.content,
      mood: e.mood ?? '',
      sticker: e.sticker ?? '',
      entry_date: e.entry_date,
    });
    setSelected(e);
    setModalMode('edit');
  };

  const openDelete = (e: JournalEntry, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setSelected(e);
    setModalMode('delete');
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.title.trim() || !user) return;
    setSaving(true);
    try {
      if (modalMode === 'add') {
        await journalService.create(user.id, form);
        showToast('Journal entry created.');
      } else if (modalMode === 'edit' && selected) {
        await journalService.update(selected.id, form);
        showToast('Journal entry updated.');
      }
      setModalMode(null);
      setViewEntry(null);
      await loadEntries();
    } catch {
      showToast('Failed to save entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await journalService.delete(selected.id);
      showToast('Entry deleted.');
      setModalMode(null);
      setViewEntry(null);
      await loadEntries();
    } catch {
      showToast('Failed to delete entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const hasEntryOnDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return entries.some(entry => entry.entry_date === dateStr);
  };

  const getEntryForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return entries.find(entry => entry.entry_date === dateStr);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const renderCalendar = () => {
    const days = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft size={16} />
          </button>
          <h2 style={{ fontSize: '1.1rem', fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--choco)', margin: 0 }}>
            {monthName}
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigateMonth('next')}
          >
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
            if (!date) {
              return <div key={`empty-${index}`} style={{ aspectRatio: 1 }} />;
            }

            const hasEntry = hasEntryOnDate(date);
            const entry = getEntryForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <button
                key={date.toISOString()}
                onClick={() => entry && setViewEntry(entry)}
                disabled={!hasEntry}
                style={{
                  aspectRatio: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: isToday ? 600 : 400,
                  border: hasEntry ? '1px solid var(--warm)' : '1px solid var(--border)',
                  background: hasEntry ? 'var(--sand)' : isToday ? 'var(--parchment)' : 'transparent',
                  color: hasEntry ? 'var(--choco)' : isToday ? 'var(--brown)' : 'var(--text-muted)',
                  cursor: hasEntry ? 'pointer' : 'default',
                  position: 'relative',
                }}
              >
                {date.getDate()}
                {entry?.sticker && (
                  <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '0.6rem' }}>
                    {entry.sticker}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // View single entry
  if (viewEntry) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewEntry(null)}>
            ← Back
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.375rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={(e) => { setViewEntry(null); openEdit(viewEntry, e); }}>
              <Pencil size={13} /> Edit
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--rose)' }}
              onClick={(e) => { openDelete(viewEntry, e); }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '2rem',
          }}
        >
          {viewEntry.sticker && (
            <div className="journal-sticker">{viewEntry.sticker}</div>
          )}
          <div className="journal-date">{formatEntryDate(viewEntry.entry_date)}</div>
          <h1
            style={{
              fontFamily: 'Lora, serif',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--choco)',
              margin: '0.25rem 0 1.25rem',
            }}
          >
            {viewEntry.title}
          </h1>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.8,
              fontSize: '0.9rem',
              color: 'var(--text-main)',
            }}
          >
            {viewEntry.content || <em style={{ color: 'var(--text-light)' }}>No content.</em>}
          </div>
        </div>

        {/* Delete modal while viewing */}
        {modalMode === 'delete' && selected && (
          <Modal title="Delete Entry" onClose={() => setModalMode(null)}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Delete <strong>{selected.title}</strong>? This cannot be undone.
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

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 680 }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Journal</h1>
          <p className="page-subtitle">Your personal daily diary.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', background: 'var(--parchment)', borderRadius: '8px', padding: '0.25rem' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setViewMode('timeline')}
              style={{
                background: viewMode === 'timeline' ? 'var(--sand)' : 'transparent',
                borderRadius: '6px',
                padding: '0.375rem 0.75rem',
              }}
            >
              <List size={14} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setViewMode('calendar')}
              style={{
                background: viewMode === 'calendar' ? 'var(--sand)' : 'transparent',
                borderRadius: '6px',
                padding: '0.375rem 0.75rem',
              }}
            >
              <Calendar size={14} />
            </button>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus /> New Entry
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon="🌸"
          title="Your journal is empty"
          description="Write about your day."
          action={
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus /> New Entry
            </button>
          }
        />
      ) : viewMode === 'timeline' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="journal-entry-card"
              onClick={() => setViewEntry(entry)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setViewEntry(entry)}
              aria-label={`Open ${entry.title}`}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {entry.sticker && <span className="journal-sticker">{entry.sticker}</span>}
                  <div className="journal-date">{formatEntryDate(entry.entry_date)}</div>
                  <h3 className="journal-title">{entry.title}</h3>
                  {entry.content && <p className="journal-preview">{entry.content}</p>}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button
                    className="btn-icon"
                    onClick={(e) => openEdit(entry, e)}
                    aria-label={`Edit ${entry.title}`}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={(e) => openDelete(entry, e)}
                    aria-label={`Delete ${entry.title}`}
                    title="Delete"
                    style={{ color: 'var(--rose)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          {renderCalendar()}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <Modal
          title={modalMode === 'add' ? 'New Journal Entry' : 'Edit Entry'}
          onClose={() => setModalMode(null)}
        >
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label" htmlFor="entry-date">Date</label>
              <input
                id="entry-date"
                type="date"
                className="form-input"
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="entry-title">Title</label>
              <input
                id="entry-title"
                type="text"
                className="form-input"
                placeholder="A Productive Day"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sticker</label>
              <div className="sticker-grid">
                {STICKERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`sticker-option${form.sticker === s ? ' selected' : ''}`}
                    onClick={() => setForm({ ...form, sticker: form.sticker === s ? '' : s })}
                    aria-label={`Select sticker ${s}`}
                    aria-pressed={form.sticker === s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mood</label>
              <div className="sticker-grid">
                {MOODS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    className={`sticker-option${form.mood === mood ? ' selected' : ''}`}
                    onClick={() => setForm({ ...form, mood: form.mood === mood ? '' : mood })}
                    aria-label={`Select mood ${mood}`}
                    aria-pressed={form.mood === mood}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
            {showPrompt && (
              <div style={{
                padding: '0.75rem',
                background: 'var(--blush)',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: 'var(--brown)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Sparkles size={16} />
                <span>Writing prompt: {form.content}</span>
                <button
                  className="btn-icon"
                  onClick={() => {
                    setForm({ ...form, content: '' });
                    setShowPrompt(false);
                  }}
                  style={{ marginLeft: 'auto' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="entry-content">What's on your mind?</label>
              <textarea
                id="entry-content"
                className="form-textarea"
                placeholder="Today I…"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                style={{ minHeight: 140 }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim()}>
                {saving ? 'Saving…' : modalMode === 'add' ? 'Save Entry' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm */}
      {modalMode === 'delete' && selected && (
        <Modal title="Delete Entry" onClose={() => setModalMode(null)}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Delete <strong>{selected.title}</strong>?
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
