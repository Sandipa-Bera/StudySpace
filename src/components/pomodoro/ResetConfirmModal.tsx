import { AlertTriangle } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  accumulatedMinutes: number;
}

export function ResetConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  accumulatedMinutes,
}: ResetConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="pomo-modal-backdrop" onClick={onCancel}>
      <div
        className="pomo-modal-card pomo-confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pomo-confirm-title"
      >
        <div className="pomo-confirm-icon-wrap">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>

        <h3 id="pomo-confirm-title" className="pomo-confirm-title">
          Reset Active Session?
        </h3>

        <p className="pomo-confirm-text">
          You currently have a session in progress.{' '}
          {accumulatedMinutes > 0 ? (
            <>
              Your <strong>{accumulatedMinutes}m</strong> of focus so far will be saved to your
              history as an interrupted session so you don't lose credit for your effort.
            </>
          ) : (
            <>Resetting now will discard this session and return the timer to the beginning.</>
          )}
        </p>

        <div className="pomo-confirm-actions">
          <button
            type="button"
            className="pomo-btn-secondary flex-1"
            onClick={onCancel}
            autoFocus
          >
            Keep Focusing
          </button>
          <button
            type="button"
            className="pomo-btn-danger flex-1"
            onClick={onConfirm}
          >
            Yes, Reset
          </button>
        </div>
      </div>
    </div>
  );
}
