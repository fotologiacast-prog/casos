export type PortalNotification = {
  id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string;
};

export const fetchPortalNotifications = async (token: string): Promise<PortalNotification[]> => {
  const response = await fetch(`/api/portal-notifications?token=${encodeURIComponent(token)}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.details || data.error || 'Falha ao buscar notificações.');
  }

  return data.notifications || [];
};
