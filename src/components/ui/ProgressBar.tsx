import { calcProgress } from '../../utils/progress';

interface ProgressBarProps {
  completed: number;
  total: number;
  showLabel?: boolean;
}

export function ProgressBar({ completed, total, showLabel = false }: ProgressBarProps) {
  const pct = calcProgress(completed, total);
  const isComplete = pct === 100;

  return (
    <div>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginBottom: '0.375rem',
          }}
        >
          <span>{completed} / {total} completed</span>
          <span style={{ fontWeight: 600, color: isComplete ? 'var(--dusty)' : 'var(--warm)' }}>
            {pct}%
          </span>
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`progress-fill${isComplete ? ' complete' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
