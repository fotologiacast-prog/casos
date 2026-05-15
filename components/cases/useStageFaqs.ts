import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCaseStageFaqTypes } from '../../utils/caseConstants';

export interface StageFaq {
  id: string;
  stage_type: string;
  title: string;
  content: string;
  image_url?: string | null;
  order: number;
}

type StageFaqCacheEntry = {
  data?: StageFaq[];
  promise?: Promise<StageFaq[]>;
};

const stageFaqCache = new Map<string, StageFaqCacheEntry>();

const fetchStageFaqs = async (cacheKey: string) => {
  const cached = stageFaqCache.get(cacheKey);
  if (cached?.data) return cached.data;
  if (cached?.promise) return cached.promise;

  const promise = fetch(`/api/faq?stage_type=${encodeURIComponent(cacheKey)}`)
    .then(async response => {
      if (!response.ok) return [];
      const data = await response.json();
      const faqs = data.faqs || [];
      stageFaqCache.set(cacheKey, { data: faqs });
      return faqs;
    })
    .catch(error => {
      stageFaqCache.delete(cacheKey);
      throw error;
    });

  stageFaqCache.set(cacheKey, { promise });
  return promise;
};

export const useStageFaqs = (stageType: string) => {
  const cacheKey = useMemo(() => getCaseStageFaqTypes(stageType).join('|'), [stageType]);
  const [faqs, setFaqs] = useState<StageFaq[]>(() => stageFaqCache.get(cacheKey)?.data || []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFaqs(stageFaqCache.get(cacheKey)?.data || []);
  }, [cacheKey]);

  const loadFaqs = useCallback(async () => {
    const cached = stageFaqCache.get(cacheKey);
    if (cached?.data) {
      setFaqs(cached.data);
      return cached.data;
    }

    setIsLoading(true);
    try {
      const loadedFaqs = await fetchStageFaqs(cacheKey);
      setFaqs(loadedFaqs);
      return loadedFaqs;
    } catch {
      setFaqs([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey]);

  return { faqs, isLoading, loadFaqs };
};
