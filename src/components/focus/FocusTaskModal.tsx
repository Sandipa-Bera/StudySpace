import React, { useState, useEffect } from 'react';
import { Trash2, Clock, Tag } from 'lucide-react';
import { Modal } from '../ssc/SscModal';
import type { FocusTask, FocusTaskForm, FocusTaskStatus } from '../../types/focusTask.types';

interface FocusTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: FocusTask | null;
  defaultDate: string;
  onSave: (form: FocusTaskForm, taskId?: string) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

const PRESET_DURATIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
];

const COMMON_CATEGORIES = ['Data Science', 'SSC CGL', 'Revision', 'Core Subjects', 'Practice'];

export function FocusTaskModal({
  isOpen,
  onClose,
  taskToEdit,
  defaultDate,
  onSave,
  onDelete,
}: FocusTaskModalProps) {
  const [taskName, setTaskName] = useState('');
  const [category, setCategory] = useState('');
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [date, setDate] = useState(defaultDate);
  const [status, setStatus] = useState<FocusTaskStatus>('pending');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTaskName(taskToEdit.task_name);
      setCategory(taskToEdit.category || '');
      const totalMins = taskToEdit.planned_duration_minutes || 60;
      setHours(Math.floor(totalMins / 60));
      setMinutes(totalMins % 60);
      setDate(taskToEdit.date || defaultDate);
      setStatus(taskToEdit.status || 'pending');
    } else {
      setTaskName('');
      setCategory('');
      setHours(1);
      setMinutes(0);
      setDate(defaultDate);
      setStatus('pending');
    }
    setError(null);
  }, [taskToEdit, isOpen, defaultDate]);

  const setTotalMinutes = (totalMins: number) => {
    setHours(Math.floor(totalMins / 60));
    setMinutes(totalMins % 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) {
      setError('Task name is required.');
      return;
    }

    const totalDurationMinutes = Number(hours) * 60 + Number(minutes);
    if (totalDurationMinutes <= 0) {
      setError('Please set a planned duration of at least 1 minute.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          task_name: taskName.trim(),
          category: category.trim() || null,
          planned_duration_minutes: totalDurationMinutes,
          date,
          status,
        },
        taskToEdit?.id
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!taskToEdit || !onDelete) return;
    if (!window.confirm(`Delete task "${taskToEdit.task_name}"?`)) return;
    setDeleting(true);
    try {
      await onDelete(taskToEdit.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete task.');
    } finally {
      setDeleting(false);
    }
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
      <div>
        {taskToEdit && onDelete && (
          <button
            type="button"
            className="ssc-btn ssc-btn-outline"
            style={{ color: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            <Trash2 size={15} />
            <span>{deleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="ssc-btn ssc-btn-outline"
          onClick={onClose}
          disabled={saving || deleting}
        >
          Cancel
        </button>
        <button
          type="submit"
          form="focus-task-form"
          className="ssc-btn ssc-btn-primary"
          disabled={saving || deleting}
        >
          {saving ? 'Saving...' : taskToEdit ? 'Save Changes' : 'Add Task'}
        </button>
      </div>
    </div>
  );

  const currentTotalMins = Number(hours) * 60 + Number(minutes);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={taskToEdit ? 'Edit Study Task' : 'Add Study Task'}
      footer={footer}
      width={520}
    >
      <form id="focus-task-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label className="ssc-label">Task Name *</label>
          <input
            type="text"
            className="ssc-input"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="e.g. Learn Matplotlib or Complete one chapter"
            autoFocus
            required
          />
        </div>

        <div>
          <label className="ssc-label">Subject / Category (Optional)</label>
          <input
            type="text"
            className="ssc-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Data Science, SSC CGL, Revision..."
            list="category-suggestions"
          />
          <datalist id="category-suggestions">
            {COMMON_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {COMMON_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className="ssc-badge"
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: category === cat ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: category === cat ? '#6366f1' : 'var(--text-muted)',
                }}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Planned Duration Input */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label className="ssc-label" style={{ margin: 0 }}>Planned Study Duration *</label>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)' }}>
              {hours}h {minutes}m ({currentTotalMins} min)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hours</label>
              <input
                type="number"
                className="ssc-input"
                min={0}
                max={12}
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value || '0', 10)))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minutes</label>
              <input
                type="number"
                className="ssc-input"
                min={0}
                max={59}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value || '0', 10))))}
              />
            </div>
          </div>

          {/* Preset Duration Pills */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {PRESET_DURATIONS.map((preset) => {
              const isSelected = currentTotalMins === preset.minutes;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className="ssc-btn ssc-btn-outline"
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    borderColor: isSelected ? '#6366f1' : 'var(--border)',
                    color: isSelected ? '#6366f1' : 'var(--text-muted)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  onClick={() => setTotalMinutes(preset.minutes)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="ssc-label">Scheduled Date</label>
            <input
              type="date"
              className="ssc-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="ssc-label">Initial Status</label>
            <select
              className="ssc-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as FocusTaskStatus)}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}

