/**
 * pomodoroNotifications.ts
 * ─────────────────────────────────────────────────────────────
 * Browser notification dispatcher for Pomodoro timer events.
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return Notification.permission;
  }
}

export function showPomodoroNotification(options: {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notif = new Notification(options.title, {
      body: options.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options.tag || 'pomodoro-phase-notification',
      requireInteraction: true,
      silent: false,
    });

    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // window focus might be restricted in some browsers
      }
      if (options.onClick) {
        options.onClick();
      }
      notif.close();
    };

    return notif;
  } catch (err) {
    console.warn('Error showing notification:', err);
    return null;
  }
}
