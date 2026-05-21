import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReadyTestimonial } from '../../types';
import { fetchReadyTestimonials } from '../../services/testimonialService';

const demoReadyTestimonials: ReadyTestimonial[] = [
  {
    id: 'demo-maria-social',
    caseId: 'demo-maria',
    patientName: 'Maria Eduarda',
    mondayItemName: 'Maria Eduarda - Facetas superiores',
    patientAge: 42,
    patientGender: 'Feminino',
    patientProcedure: 'Facetas',
    caseCreatedAt: '2026-04-11T00:00:00',
    mondayItemId: 'demo',
    subitemId: 'demo-social',
    title: 'Depoimento vertical - versão reels',
    status: 'Editado',
    creativeType: 'Reels 9:16',
    assets: [
      {
        id: 'demo-image-1',
        name: 'maria-resultado-feed.jpg',
        public_url: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1000&q=80',
      },
    ],
  },
  {
    id: 'demo-carlos-post',
    caseId: 'demo-carlos',
    patientName: 'Carlos Henrique',
    mondayItemName: 'Carlos Henrique - Protocolo inferior',
    patientAge: 58,
    patientGender: 'Masculino',
    patientProcedure: 'Protocolo',
    caseCreatedAt: '2026-03-26T00:00:00',
    mondayItemId: 'demo',
    subitemId: 'demo-post',
    title: 'Carrossel antes e depois',
    status: 'Pronto',
    creativeType: 'Carrossel',
    assets: [
      {
        id: 'demo-image-2',
        name: 'carlos-carrossel-01.jpg',
        public_url: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1000&q=80',
      },
    ],
  },
];

type ReadyTestimonialsCacheEntry = {
  data?: ReadyTestimonial[];
  promise?: Promise<ReadyTestimonial[]>;
};

const readyTestimonialsCache = new Map<string, ReadyTestimonialsCacheEntry>();
const READY_TESTIMONIALS_POLL_INTERVAL_MS = 20_000;

const getReadyTestimonialsCounts = (items: ReadyTestimonial[]) =>
  items.reduce<Record<string, number>>((counts, item) => {
    counts[item.caseId] = (counts[item.caseId] || 0) + (item.assets.length > 0 ? 1 : 0);
    return counts;
  }, {});

const requestReadyTestimonials = async (token: string, force = false) => {
  if (force) readyTestimonialsCache.delete(token);

  const cached = readyTestimonialsCache.get(token);
  if (cached?.data) return cached.data;
  if (cached?.promise) return cached.promise;

  const promise = fetchReadyTestimonials(token)
    .then(data => {
      readyTestimonialsCache.set(token, { data });
      return data;
    })
    .catch(error => {
      readyTestimonialsCache.delete(token);
      throw error;
    });

  readyTestimonialsCache.set(token, { promise });
  return promise;
};

export const prefetchReadyTestimonials = (token: string, isDemo?: boolean) =>
  isDemo ? Promise.resolve(demoReadyTestimonials) : requestReadyTestimonials(token);

export const useReadyTestimonials = (token: string, isDemo?: boolean, enabled = true) => {
  const [testimonials, setTestimonials] = useState<ReadyTestimonial[]>(() => (isDemo ? demoReadyTestimonials : []));
  const [isLoading, setIsLoading] = useState(enabled && !isDemo);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRequestRef = useRef<Promise<ReadyTestimonial[]> | null>(null);
  const testimonialsRef = useRef(testimonials);

  useEffect(() => {
    testimonialsRef.current = testimonials;
  }, [testimonials]);

  const loadTestimonials = useCallback(async (refreshing = false, silent = false) => {
    if (!enabled) {
      setIsLoading(false);
      setIsRefreshing(false);
      return [];
    }

    if (isDemo) {
      setTestimonials(demoReadyTestimonials);
      setIsLoading(false);
      setIsRefreshing(false);
      setError(null);
      return demoReadyTestimonials;
    }

    if (inFlightRequestRef.current) return inFlightRequestRef.current;

    if (!silent) {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
    }
    if (!silent) setError(null);

    const request = (async () => {
      const loaded = await requestReadyTestimonials(token, refreshing);
      setTestimonials(loaded);
      return loaded;
    })();

    inFlightRequestRef.current = request;

    try {
      return await request;
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os depoimentos.');
      }
      return testimonialsRef.current;
    } finally {
      inFlightRequestRef.current = null;
      if (!silent) {
        setIsLoading(false);
        if (refreshing) setIsRefreshing(false);
      }
    }
  }, [enabled, isDemo, token]);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const loaded = await loadTestimonials(false);
        if (!cancelled) setTestimonials(loaded);
      } catch {
        // Error state is handled in loadTestimonials.
      }
    };

    if (enabled) void loadInitial();
    else setIsLoading(false);
    return () => { cancelled = true; };
  }, [enabled, loadTestimonials]);

  useEffect(() => {
    if (!enabled || isDemo) return undefined;

    const poll = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadTestimonials(true, true);
    };

    const interval = window.setInterval(poll, READY_TESTIMONIALS_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, isDemo, loadTestimonials]);

  const countsByCaseId = useMemo(() => getReadyTestimonialsCounts(testimonials), [testimonials]);
  const totalAssets = useMemo(
    () => testimonials.reduce((sum, item) => sum + item.assets.length, 0),
    [testimonials]
  );

  return {
    testimonials,
    countsByCaseId,
    totalAssets,
    isLoading,
    isRefreshing,
    error,
    refresh: () => loadTestimonials(true).catch(() => []),
  };
};
