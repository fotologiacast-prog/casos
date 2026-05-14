import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReadyTestimonial, TestimonialAsset } from '../../types';
import { fetchReadyTestimonials } from '../../services/testimonialService';

interface ReadyTestimonialsProps {
  token: string;
  clientName: string;
  isDemo?: boolean;
  initialSearch?: string;
  onOpenCase?: (caseId: string) => void;
}

const demoTestimonials: ReadyTestimonial[] = [
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
    status: 'Pronto',
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

const isImageAsset = (asset: TestimonialAsset) =>
  /\.(png|jpe?g|webp|gif|avif|bmp|heic)$/i.test(asset.name) ||
  /[?&](format|fm)=(png|jpe?g|webp|gif|avif)/i.test(asset.public_url);

const isVideoAsset = (asset: TestimonialAsset) =>
  /\.(mp4|m4v|mov|qt|webm|avi|mkv|mpeg|mpg|3gp|3g2|mts|m2ts|ts|wmv|flv|f4v|ogv|mxf|hevc|h265|prores)$/i.test(asset.name);

const isAudioAsset = (asset: TestimonialAsset) =>
  /\.(mp3|m4a|aac|wav|wave|aiff?|flac|ogg|oga|opus|wma|amr|caf|alac)$/i.test(asset.name);

const getDriveFileIdFromUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname === 'drive.google.com') {
      const pathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      return parsed.searchParams.get('id') || pathMatch?.[1] || null;
    }
    return null;
  } catch {
    return null;
  }
};

const getDrivePreviewUrl = (url: string) => {
  const fileId = getDriveFileIdFromUrl(url);
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : null;
};

const getDriveThumbnailUrl = (url: string) => {
  const fileId = getDriveFileIdFromUrl(url);
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000` : null;
};

const ageRanges = [
  { value: 'all', label: 'Todas idades' },
  { value: '0-18', label: 'Até 18' },
  { value: '19-30', label: '19–30' },
  { value: '31-45', label: '31–45' },
  { value: '46-60', label: '46–60' },
  { value: '61+', label: '61+' },
];

const matchesAgeRange = (age: number | null, range: string) => {
  if (range === 'all') return true;
  if (age === null) return false;
  if (range === '61+') return age >= 61;
  const [min, max] = range.split('-').map(Number);
  return age >= min && age <= max;
};

const splitProcedures = (value?: string | null) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const SelectChip: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }> = ({ value, onChange, options, label }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors appearance-none pr-8 bg-no-repeat bg-right"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239CA3AF'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`, backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </label>
);

const VideoPreview: React.FC<{ asset: TestimonialAsset }> = ({ asset }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDrivePlayer, setShowDrivePlayer] = useState(false);
  const drivePreviewUrl = getDrivePreviewUrl(asset.public_url);
  const driveThumbnailUrl = getDriveThumbnailUrl(asset.public_url);

  if (drivePreviewUrl && !showDrivePlayer) {
    return (
      <button
        type="button"
        onClick={() => setShowDrivePlayer(true)}
        className="relative flex h-full min-h-[240px] w-full items-center justify-center overflow-hidden bg-zinc-950 text-white"
        aria-label={`Reproduzir ${asset.name}`}
      >
        {driveThumbnailUrl ? (
          <img
            src={driveThumbnailUrl}
            alt=""
            width={1000}
            height={1000}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        ) : (
          <span className="absolute inset-0 bg-zinc-900" />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-950 shadow-xl">
          <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 h-7 w-7" aria-hidden="true">
            <path d="M6.3 3.84A1 1 0 0 0 4.75 4.67v10.66a1 1 0 0 0 1.55.83l8-5.33a1 1 0 0 0 0-1.66l-8-5.33Z" />
          </svg>
        </span>
      </button>
    );
  }

  if (drivePreviewUrl) {
    return (
      <iframe
        src={drivePreviewUrl}
        className="h-full w-full bg-black"
        allow="autoplay; fullscreen"
        allowFullScreen
        loading="lazy"
        title={asset.name}
      />
    );
  }

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if ((video as any).webkitRequestFullscreen) {
      (video as any).webkitRequestFullscreen();
    }
  };

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900 p-8 text-center text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mb-3 h-9 w-9 text-zinc-400" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h12M6 22h12M8 2c0 4 2.5 6 4 7 1.5-1 4-3 4-7M8 22c0-4 2.5-6 4-7 1.5 1 4 3 4 7" />
        </svg>
        <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Processando no Drive</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          O Google Drive ainda está processando este vídeo. <br />
          Ele estará disponível automaticamente em instantes.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <video
        ref={videoRef}
        src={asset.public_url}
        className="h-full w-full object-contain"
        playsInline
        preload="none"
        onClick={togglePlayback}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
      />
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex items-center gap-2 rounded-full bg-black/80 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition-colors hover:bg-black"
          aria-label={isPlaying ? `Pausar ${asset.name}` : `Reproduzir ${asset.name}`}
        >
          {isPlaying ? (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M5.75 4.5a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-1.5 0v-9.5a.75.75 0 0 1 .75-.75Zm7.75 0a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-1.5 0v-9.5a.75.75 0 0 1 .75-.75Z" />
              </svg>
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.3 3.84A1 1 0 0 0 4.75 4.67v10.66a1 1 0 0 0 1.55.83l8-5.33a1 1 0 0 0 0-1.66l-8-5.33Z" />
              </svg>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/80 text-white shadow-lg backdrop-blur transition-colors hover:bg-black"
          aria-label={`Abrir ${asset.name} em tela cheia`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M13.28 2.22a.75.75 0 0 0-1.06 1.06l1.47 1.47-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06l-1.47-1.47 1.47-1.47a.75.75 0 0 0-1.06-1.06l-1.47 1.47-1.47-1.47ZM3.75 2a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-2.25A.75.75 0 0 1 3 5V2.75a.75.75 0 0 1 .75-.75ZM3 15v2.25c0 .414.336.75.75.75h2.25a.75.75 0 0 0 0-1.5h-1.5V15a.75.75 0 0 0-1.5 0ZM16.25 18a.75.75 0 0 1-.75-.75V15.75h-1.5a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-.75.75Z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const AudioPreview: React.FC<{ asset: TestimonialAsset }> = ({ asset }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-5 text-white">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </div>
    <p className="text-xs font-medium uppercase tracking-widest text-white/50">Áudio</p>
    <audio src={asset.public_url} controls preload="none" className="w-full max-w-sm" />
  </div>
);

const AssetPreview: React.FC<{ asset: TestimonialAsset }> = ({ asset }) => {
  if (isImageAsset(asset)) {
    return (
      <img
        src={asset.public_url}
        alt={asset.name}
        width={1000}
        height={1000}
        className="h-full w-full object-contain"
        decoding="async"
        loading="lazy"
      />
    );
  }

  if (isVideoAsset(asset)) {
    return <VideoPreview asset={asset} />;
  }

  if (isAudioAsset(asset)) {
    return <AudioPreview asset={asset} />;
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

const formatCaseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const InfoChip: React.FC<{ value?: string | number | null }> = ({ value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-600">
      {value}
    </span>
  );
};

const ReadyTestimonials: React.FC<ReadyTestimonialsProps> = ({ token, clientName, isDemo, initialSearch = '', onOpenCase }) => {
  const [testimonials, setTestimonials] = useState<ReadyTestimonial[]>([]);
  const [search, setSearch] = useState('');
  const [filterProcedure, setFilterProcedure] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [filterCreativeType, setFilterCreativeType] = useState('all');
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

  const procedures = useMemo(() => {
    const set = new Set<string>();
    testimonials.forEach(t => splitProcedures(t.patientProcedure).forEach(proc => set.add(proc)));
    return Array.from(set).sort();
  }, [testimonials]);

  const creativeTypes = useMemo(() => {
    const set = new Set<string>();
    testimonials.forEach(t => { if (t.creativeType) set.add(t.creativeType); });
    return Array.from(set).sort();
  }, [testimonials]);

  const filteredTestimonials = useMemo(() => {
    const query = search.trim().toLowerCase();
    return testimonials.filter(item => {
      if (query && !(
        item.patientName.toLowerCase().includes(query) ||
        (item.mondayItemName || '').toLowerCase().includes(query) ||
        (item.patientProcedure || '').toLowerCase().includes(query) ||
        (item.patientGender || '').toLowerCase().includes(query) ||
        (item.creativeType || '').toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.assets.some(asset => asset.name.toLowerCase().includes(query))
      )) return false;
      
      if (filterProcedure !== 'all' && !splitProcedures(item.patientProcedure).includes(filterProcedure)) return false;
      if (filterGender !== 'all' && item.patientGender !== filterGender) return false;
      if (filterCreativeType !== 'all' && item.creativeType !== filterCreativeType) return false;
      if (!matchesAgeRange(item.patientAge, filterAge)) return false;
      
      return true;
    });
  }, [search, testimonials, filterProcedure, filterGender, filterAge, filterCreativeType]);

  const totalAssets = testimonials.reduce((sum, item) => sum + item.assets.length, 0);

  const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
        active ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50'
      }`}
    >
      {children}
    </button>
  );

  return (
    <section className="animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{clientName}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Materiais prontos</h1>
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

      <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Gênero</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'Feminino', label: 'Feminino' },
              { value: 'Masculino', label: 'Masculino' },
              { value: 'Pref. não informar', label: 'Outro' },
            ].map(opt => (
              <FilterChip key={opt.value} active={filterGender === opt.value} onClick={() => setFilterGender(opt.value)}>
                {opt.label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Faixa Etária</p>
          <div className="flex flex-wrap gap-2">
            {ageRanges.map(opt => (
              <FilterChip key={opt.value} active={filterAge === opt.value} onClick={() => setFilterAge(opt.value)}>
                {opt.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {procedures.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Procedimento</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filterProcedure === 'all'} onClick={() => setFilterProcedure('all')}>Todos</FilterChip>
              {procedures.map(proc => (
                <FilterChip key={proc} active={filterProcedure === proc} onClick={() => setFilterProcedure(proc)}>
                  {proc}
                </FilterChip>
              ))}
            </div>
          </div>
        )}

        {creativeTypes.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tipo de criativo</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filterCreativeType === 'all'} onClick={() => setFilterCreativeType('all')}>Todos</FilterChip>
              {creativeTypes.map(type => (
                <FilterChip key={type} active={filterCreativeType === type} onClick={() => setFilterCreativeType(type)}>
                  {type}
                </FilterChip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="relative">
          <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            name="testimonial-search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            autoComplete="off"
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
      ) : !isLoading && filteredTestimonials.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-zinc-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-zinc-900">Nenhum material pronto</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {(search.trim() || filterProcedure !== 'all' || filterGender !== 'all' || filterAge !== 'all' || filterCreativeType !== 'all') ? 'Tente ajustar os filtros ou busca.' : 'Quando houver arquivos nos subelementos do Monday, eles aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 columns-1 gap-5 space-y-5 sm:columns-2 lg:columns-3">
          {filteredTestimonials.map(testimonial => (
            <article key={testimonial.id} className="break-inside-avoid overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md" style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}>
              {/* Title header */}
              <div className="border-b border-zinc-100 px-4 py-3 bg-zinc-50/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Material</p>
                  {testimonial.creativeType && (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700">
                      {testimonial.creativeType}
                    </span>
                  )}
                </div>
                <h2 className="mt-0.5 text-base font-black leading-snug text-zinc-950">{testimonial.title}</h2>
              </div>

              {/* Assets - Pinterest Style */}
              <div className="space-y-4 p-4">
                {testimonial.assets.map(asset => (
                  <div
                    key={asset.id}
                    className="group overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 transition-all hover:border-zinc-300"
                  >
                    <div className="flex min-h-[200px] items-center justify-center overflow-hidden bg-zinc-100">
                      <AssetPreview asset={asset} />
                    </div>
                    <div className="p-3">
                      <a
                        href={getDownloadUrl(token, testimonial, asset, isDemo)}
                        download={asset.name}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-zinc-800"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                        </svg>
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Meta info at bottom */}
              <div className="px-4 py-4 border-t border-zinc-100 bg-zinc-50/30">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <InfoChip value={testimonial.patientName} />
                    <InfoChip value={testimonial.patientAge ? `${testimonial.patientAge} anos` : null} />
                    <InfoChip value={testimonial.patientGender} />
                    <InfoChip value={testimonial.patientProcedure} />
                    <InfoChip value={testimonial.creativeType} />
                    <InfoChip value={formatCaseDate(testimonial.caseCreatedAt)} />
                  </div>
                  <div className="flex items-center justify-between">
                    {testimonial.status && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {testimonial.status}
                      </span>
                    )}
                    {onOpenCase && (
                      <button
                        type="button"
                        onClick={() => onOpenCase(testimonial.caseId)}
                        className="text-[11px] font-bold text-zinc-500 hover:text-zinc-950 transition-colors flex items-center gap-1"
                      >
                        Ver caso
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                          <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v3.69a.75.75 0 0 0 1.5 0v-5.5A.75.75 0 0 0 14.25 5h-5.5a.75.75 0 0 0 0 1.5h3.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default ReadyTestimonials;
