import { format, parseISO } from 'date-fns';

export function formatEntryDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'MMMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}
