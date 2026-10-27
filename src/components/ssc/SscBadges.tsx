import type { ChapterStatus, PriorityLevel } from '../../types/ssc.types';

// ─── Status Badge ───────────────────────────────────────────

const STATUS_CONFIG: Record<
  ChapterStatus,
  { label: string; className: string; emoji: string }
> = {
  not_started: { label: 'Not Started', className: 'ssc-badge-neutral',   emoji: '○' },
  in_progress: { label: 'In Progress', className: 'ssc-badge-blue',      emoji: '◑' },
  completed:   { label: 'Completed',   className: 'ssc-badge-green',     emoji: '●' },
  revise:      { label: 'Revise',      className: 'ssc-badge-amber',     emoji: '↺' },
};

export function StatusBadge({ status }: { status: ChapterStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  return (
    <span className={`ssc-badge ${cfg.className}`} role="status">
      <span aria-hidden="true">{cfg.emoji}</span> {cfg.label}
    </span>
  );
}

// ─── Priority Badge ─────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; className: string }
> = {
  high:   { label: 'High',   className: 'ssc-badge-red' },
  medium: { label: 'Medium', className: 'ssc-badge-amber' },
  low:    { label: 'Low',    className: 'ssc-badge-neutral' },
};

export function PriorityBadge({ priority }: { priority: PriorityLevel | null | undefined }) {
  if (!priority) return null;
  const cfg = PRIORITY_CONFIG[priority];
  return <span className={`ssc-badge ${cfg.className}`}>{cfg.label}</span>;
}

// ─── Confidence Stars ───────────────────────────────────────

export function ConfidenceStars({
  rating,
  interactive = false,
  onChange,
}: {
  rating: number | null | undefined;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const value = rating ?? 0;
  return (
    <div className="ssc-stars" aria-label={`Confidence ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(n)}
          className={`ssc-star${n <= value ? ' filled' : ''}`}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Accuracy Bar ───────────────────────────────────────────

export function AccuracyBar({ accuracy }: { accuracy: number }) {
  const colour =
    accuracy >= 80 ? 'var(--success)' :
    accuracy >= 60 ? 'var(--warning)' :
    'var(--error)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div className="progress-track" style={{ flex: 1, height: 6 }}>
        <div
          className="progress-fill"
          style={{ width: `${accuracy}%`, background: colour }}
        />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colour, minWidth: 36, textAlign: 'right' }}>
        {accuracy}%
      </span>
    </div>
  );
}

// ─── Mini stat chip ─────────────────────────────────────────

export function StatChip({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="ssc-stat-chip">
      <div className="ssc-stat-value" style={color ? { color } : undefined}>{value}</div>
      <div className="ssc-stat-label">{label}</div>
      {sub && <div className="ssc-stat-sub">{sub}</div>}
    </div>
  );
}
