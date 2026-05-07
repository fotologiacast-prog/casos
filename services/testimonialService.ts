import { ReadyTestimonial } from '../types';

const readApiResponse = async (response: Response, fallbackMessage: string) => {
  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const details = typeof data.details === 'string' ? data.details : '';
    const message = details && data.error
      ? `${data.error} ${details}`
      : details || data.error;
    const fallback = responseText
      ? responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)
      : '';
    throw new Error(message || fallback || `${fallbackMessage} HTTP ${response.status}`);
  }

  return data;
};

export const fetchReadyTestimonials = async (token: string): Promise<ReadyTestimonial[]> => {
  const response = await fetch(`/api/testimonials?token=${encodeURIComponent(token)}`);
  const data = await readApiResponse(response, 'Falha ao buscar depoimentos.');
  return data.testimonials || [];
};
