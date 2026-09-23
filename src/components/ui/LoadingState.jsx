export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-state">
      <div className="spinner" role="status" aria-label="Loading" />
      <div>{message}</div>
    </div>
  );
}
