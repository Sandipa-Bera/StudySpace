export function calcProgress(completed, total) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
