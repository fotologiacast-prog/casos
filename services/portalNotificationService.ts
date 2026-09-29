export type PortalNotification = {
  id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string;
  read_at?: string | null;
};

export const fetchPortalNotifications = async (token: string): Promise<PortalNotification[]> => {
  const response = await fetch(`/api/portal-notifications?token=${encodeURIComponent(token)}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.details || data.error || 'Falha ao buscar notificações.');
  }

  return data.notifications || [];
};

export const markPortalNotificationsRead = async (token: string, notificationIds: string[]): Promise<void> => {
  const ids = Array.from(new Set(notificationIds.map(String).filter(Boolean)));
  if (ids.length === 0) return;

  const response = await fetch('/api/portal-notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, notificationIds: ids }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.details || data.error || 'Falha ao marcar notificações como lidas.');
  }
};
