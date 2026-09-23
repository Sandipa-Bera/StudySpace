/**
 * Maps a raw ActivityLog record (from Supabase) to a
 * human-readable description and icon for display in the UI.
 */
export function formatActivity(log) {
  const name = log.metadata?.name ?? 'item';

  switch (log.action_type) {
    case 'topic_completed':
      return { icon: '✓', description: `Completed "${name}"` };
    case 'topic_incomplete':
      return { icon: '○', description: `Marked "${name}" as incomplete` };
    case 'topic_favorited':
      return { icon: '⭐', description: `Favorited "${name}"` };
    case 'topic_unfavorited':
      return { icon: '☆', description: `Removed "${name}" from favorites` };
    case 'note_updated':
      return { icon: '📝', description: `Updated notes for "${name}"` };
    case 'note_deleted':
      return { icon: '🗑️', description: `Deleted notes for "${name}"` };
    case 'session_started':
      return { icon: '▶️', description: `Started study session for "${name}"` };
    case 'session_ended': {
      const meta = log.metadata;
      const seconds = typeof meta?.duration_seconds === 'number' ? meta.duration_seconds : null;
      const mins = seconds != null ? Math.round(seconds / 60) : null;
      const durationText = mins != null ? ` (${mins} min)` : '';
      return { icon: '⏱️', description: `Ended study session for "${name}"${durationText}` };
    }
    case 'subject_created':
      return { icon: '📚', description: `Created subject "${name}"` };
    case 'subject_updated':
      return { icon: '✏️', description: `Updated subject "${name}"` };
    case 'chapter_created':
      return { icon: '📖', description: `Added chapter "${name}"` };
    case 'journal_created':
      return { icon: '📔', description: 'Wrote a journal entry' };
    case 'journal_updated':
      return { icon: '📔', description: 'Updated a journal entry' };
    default:
      return { icon: '•', description: log.action_type.replace(/_/g, ' ') };
  }
}
