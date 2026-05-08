import React, { useEffect, useMemo, useState } from 'react';
import { ReadyTestimonial, TestimonialAsset } from '../../types';
import { fetchReadyTestimonials } from '../../services/testimonialService';

interface ReadyTestimonialsProps {
  token: string;
  clientName: string;
  isDemo?: boolean;
  initialSearch?: string;
}

const demoTestimonials: ReadyTestimonial[] = [
  {
    id: 'demo-maria-social',
    caseId: 'demo-maria',
    patientName: 'Maria Eduarda',
    mondayItemId: 'demo',
    subitemId: 'demo-social',
    title: 'Depoimento vertical - versão reels',
    status: 'Pronto',
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
    mondayItemId: 'demo',
    subitemId: 'demo-post',
    title: 'Carrossel antes e depois',
    status: 'Pronto',
    assets: [
      {
        id: 'demo-image-2',
        name: 'carlos-carrossel-01.jpg',
        public_url: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1000&q=80',
      },
    ],
  },
];

const isImageAsset = (asset: TestimonialAsset) =>
  /\.(png|jpe?g|webp|gif|avif|bmp|heic)$/i.test(asset.name) ||
  /[?&](format|fm)=(png|jpe?g|webp|gif|avif)/i.test(asset.public_url);

const isVideoAsset = (asset: TestimonialAsset) =>
  /\.(mp4|mov|m4v|webm|avi)$/i.test(asset.name);

const AssetPreview: React.FC<{ asset: TestimonialAsset }> = ({ asset }) => {
  if (isImageAsset(asset)) {
    return (
      <img
        src={asset.public_url}
        alt={asset.name}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    );
  }

  if (isVideoAsset(asset)) {
    return (
      <video
        src={asset.public_url}
        className="h-full w-full object-contain"
        controls
        preload="metadata"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-100 text-zinc-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-.988-2.386l-4.751-4.751A3.375 3.375 0 0 0 11.375 3.5H8.25A2.25 2.25 0 0 0 6 5.75v12.5a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-4Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75V9a2.25 2.25 0 0 0 2.25 2.25h5.25" />
      </svg>
      <span className="px-4 text-center text-xs font-bold uppercase tracking-widest">Arquivo</span>
    </div>
  );
};

const getDownloadUrl = (token: string, testimonial: ReadyTestimonial, asset: TestimonialAsset, isDemo?: boolean) => {
  if (isDemo) return asset.public_url;
  const params = new URLSearchParams({
    token,
    itemId: testimonial.mondayItemId,
    subitemId: testimonial.subitemId,
    assetId: asset.id,
  });
  return `/api/testimonial-download?${params.toString()}`;
};

const ReadyTestimonials: React.FC<ReadyTestimonialsProps> = ({ token, clientName, isDemo, initialSearch = '' }) => {
  const [testimonials, setTestimonials] = useState<ReadyTestimonial[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTestimonials = async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    setError(null);
    try {
      if (isDemo) {
        setTestimonials(demoTestimonials);
        return;
      }
      setTestimonials(await fetchReadyTestimonials(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os depoimentos.');
    } finally {
      setIsLoading(false);
      if (refreshing) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTestimonials();
  }, [token, isDemo]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const filteredTestimonials = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return testimonials;
    return testimonials.filter(item =>
      item.patientName.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      item.assets.some(asset => asset.name.toLowerCase().includes(query))
    );
  }, [search, testimonials]);

  const totalAssets = testimonials.reduce((sum, item) => sum + item.assets.length, 0);

  return (
    <section className="animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{clientName}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Depoimentos prontos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {totalAssets} arquivo{totalAssets === 1 ? '' : 's'} publicado{totalAssets === 1 ? '' : 's'} pelo time
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadTestimonials(true)}
          disabled={isRefreshing || isLoading}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 active:scale-95 sm:w-auto"
        >
          {isRefreshing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
              Atualizando
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466.75.75 0 0 0-1.061 1.061 7 7 0 0 0 11.713-3.138.75.75 0 0 0-1.451-.389ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466.75.75 0 1 0 1.061-1.061A7 7 0 0 0 3.237 8.187a.75.75 0 1 0 1.451.389Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.75 8.25A.75.75 0 0 1 6 9H3.25a.75.75 0 0 1-.75-.75V5.5a.75.75 0 0 1 1.5 0v1.19l1.22-1.22a.75.75 0 0 1 1.06 1.06L5.06 7.75H6a.75.75 0 0 1 .75.5Zm6.5 3.5A.75.75 0 0 1 14 11h2.75a.75.75 0 0 1 .75.75v2.75a.75.75 0 0 1-1.5 0v-1.19l-1.22 1.22a.75.75 0 1 1-1.06-1.06l1.22-1.22H14a.75.75 0 0 1-.75-.5Z" clipRule="evenodd" />
              </svg>
              Atualizar
            </span>
          )}
        </button>
      </div>

      <div className="mt-6">
        <div className="relative">
          <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por paciente, depoimento ou arquivo..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="mt-10 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 rounded-2xl border-[3px] border-zinc-200 border-t-black animate-spin" />
            <p className="mt-4 text-sm font-semibold text-zinc-500">Carregando depoimentos...</p>
          </div>
        </div>
      ) : filteredTestimonials.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-zinc-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-zinc-900">Nenhum depoimento pronto</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {search.trim() ? 'Tente buscar por outro nome.' : 'Quando houver arquivos nos subelementos do Monday, eles aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {filteredTestimonials.map(testimonial => (
            <article key={testimonial.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="border-b border-zinc-100 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-zinc-400">{testimonial.patientName}</p>
                    <h2 className="mt-1 line-clamp-2 text-base font-bold leading-snug text-zinc-900">{testimonial.title}</h2>
                  </div>
                  {testimonial.status && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {testimonial.status}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                {testimonial.assets.map(asset => (
                  <div
                    key={asset.id}
                    className="group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-all hover:border-zinc-400"
                  >
                    <div className="flex h-[430px] max-h-[72vh] items-center justify-center overflow-hidden bg-zinc-100">
                      <AssetPreview asset={asset} />
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="min-w-0 truncate text-xs font-semibold text-zinc-700">{asset.name}</span>
                      <a
                        href={getDownloadUrl(token, testimonial, asset, isDemo)}
                        download={asset.name}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-zinc-700"
                      >
                        Download
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5H6.81l8.47 8.47a.75.75 0 1 1-1.06 1.06L5.75 7.31v3.19a.75.75 0 0 1-1.5 0v-5Z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M13.5 4.75a.75.75 0 0 1 .75-.75H16a.75.75 0 0 1 .75.75V6.5a.75.75 0 0 1-1.5 0v-.19l-3.47 3.47a.75.75 0 1 1-1.06-1.06l3.47-3.47h-.19a.75.75 0 0 1-.5-.5Z" clipRule="evenodd" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default ReadyTestimonials;
