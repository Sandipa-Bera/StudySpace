import { useState, useEffect } from 'react';
import { Modal } from './SscModal';
import { sscStudyTasksService } from '../../services/ssc/sscStudyTasks.service';
import type { SscStudyTask, SscSubject, SscChapter, StudyTaskType, StudyTaskForm } from '../../types/ssc.types';

interface SscTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  taskToEdit?: SscStudyTask | null;
  defaultDate?: string;
  subjects: SscSubject[];
  chapters: SscChapter[];
  onSaved: (task: SscStudyTask) => void;
}

export function SscTaskModal({
  isOpen,
  onClose,
  userId,
  taskToEdit,
  defaultDate,
  subjects,
  chapters,
  onSaved,
}: SscTaskModalProps) {
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<StudyTaskType>('custom');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setTaskType(taskToEdit.task_type);
      setChapterId(taskToEdit.chapter_id ?? '');
      setPlannedDate(taskToEdit.planned_date);
      setEstimatedMinutes(taskToEdit.estimated_minutes ? String(taskToEdit.estimated_minutes) : '');
      setReason(taskToEdit.reason ?? '');
      setIsCompleted(taskToEdit.is_completed);

      if (taskToEdit.chapter_id) {
        const ch = chapters.find((c) => c.id === taskToEdit.chapter_id);
        if (ch) setSelectedSubjectId(ch.subject_id);
      } else {
        setSelectedSubjectId('');
      }
    } else {
      setTitle('');
      setTaskType('learn');
      setSelectedSubjectId('');
      setChapterId('');
      setPlannedDate(defaultDate || new Date().toISOString().split('T')[0]);
      setEstimatedMinutes('');
      setReason('');
      setIsCompleted(false);
    }
    setError(null);
  }, [taskToEdit, defaultDate, isOpen, chapters]);

  // Available chapters based on selected subject
  const availableChapters = selectedSubjectId
    ? chapters.filter((c) => c.subject_id === selectedSubjectId)
    : chapters;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!plannedDate) {
      setError('Planned date is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const formData: StudyTaskForm = {
      title: title.trim(),
      task_type: taskType,
      chapter_id: chapterId || null,
      planned_date: plannedDate,
      estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
      reason: reason.trim() || null,
    };

    try {
      let savedTask: SscStudyTask;
      if (taskToEdit) {
        savedTask = await sscStudyTasksService.update(taskToEdit.id, formData);
        if (isCompleted !== taskToEdit.is_completed) {
          if (isCompleted) {
            savedTask = await sscStudyTasksService.complete(taskToEdit.id);
          } else {
            savedTask = await sscStudyTasksService.uncomplete(taskToEdit.id);
          }
        }
      } else {
        savedTask = await sscStudyTasksService.create(userId, formData);
        if (isCompleted) {
          savedTask = await sscStudyTasksService.complete(savedTask.id);
        }
      }
      onSaved(savedTask);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={taskToEdit ? 'Edit Study Task' : 'Add Study Task'}
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-ghost ssc-btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="study-task-form"
            className="btn btn-primary ssc-btn-sm"
            disabled={saving}
          >
            {saving ? 'Saving…' : taskToEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </>
      }
    >
      <form id="study-task-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <div className="ssc-alert ssc-alert-warn" style={{ marginBottom: '0.25rem' }}>
            {error}
          </div>
        )}

        <div>
          <label className="ssc-label">Task Title *</label>
          <input
            type="text"
            className="ssc-input"
            required
            placeholder="e.g. Solve 50 Number Series questions"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Task Type</label>
            <select
              className="ssc-input"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as StudyTaskType)}
            >
              <option value="learn">Learn Concept</option>
              <option value="practice">Practice Questions</option>
              <option value="revise">Revision</option>
              <option value="test">Mock Test</option>
              <option value="custom">Custom Task</option>
            </select>
          </div>

          <div>
            <label className="ssc-label">Planned Date *</label>
            <input
              type="date"
              className="ssc-input"
              required
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Filter by Subject</label>
            <select
              className="ssc-input"
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setChapterId('');
              }}
            >
              <option value="">(All Subjects / None)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ssc-label">Link to Chapter (Optional)</label>
            <select
              className="ssc-input"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
            >
              <option value="">(None - Custom Task)</option>
              {availableChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ssc-form-row-2">
          <div>
            <label className="ssc-label">Est. Duration (Minutes)</label>
            <input
              type="number"
              min={1}
              step={5}
              className="ssc-input"
              placeholder="e.g. 45"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '1.2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
              />
              Mark as Completed
            </label>
          </div>
        </div>

        <div>
          <label className="ssc-label">Notes / Reason</label>
          <textarea
            className="ssc-input"
            rows={2}
            placeholder="Focus on speed, write key formulas..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
