import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ReadyTestimonial, TestimonialAsset } from '../../types';
import { updateReadyTestimonialRating } from '../../services/testimonialService';
import {
  ReadyGalleryItem,
  buildReadyGalleryItems,
  sortReadyRecommendations,
  splitReadyProcedures,
} from './readyMaterialsLogic';
import { useReadyTestimonials } from './useReadyTestimonials';

interface ReadyTestimonialsProps {
  token: string;
  clientName: string;
  isDemo?: boolean;
  initialSearch?: string;
  onBack?: () => void;
  onOpenCase?: (caseId: string) => void;
}

type MediaNaturalSize = {
  width: number;
  height: number;
};

const mediaSizeCache = new Map<string, MediaNaturalSize>();

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
  splitReadyProcedures(value);

const formatDuration = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const PlayIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.3 3.84A1 1 0 0 0 4.75 4.67v10.66a1 1 0 0 0 1.55.83l8-5.33a1 1 0 0 0 0-1.66l-8-5.33Z" />
  </svg>
);

const PauseIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path d="M5.75 4.5a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-1.5 0v-9.5a.75.75 0 0 1 .75-.75Zm7.75 0a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-1.5 0v-9.5a.75.75 0 0 1 .75-.75Z" />
  </svg>
);

const VolumeIcon = ({ muted, className = 'h-4 w-4' }: { muted: boolean; className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    {muted ? (
      <path d="M9.383 3.076A1 1 0 0 1 11 3.858v12.284a1 1 0 0 1-1.617.782L5.35 13.75H3.5A1.5 1.5 0 0 1 2 12.25v-4.5a1.5 1.5 0 0 1 1.5-1.5h1.85l4.033-3.174Zm5.337 4.144a.75.75 0 0 1 1.06 0L17 8.44l1.22-1.22a.75.75 0 1 1 1.06 1.06L18.06 9.5l1.22 1.22a.75.75 0 1 1-1.06 1.06L17 10.56l-1.22 1.22a.75.75 0 0 1-1.06-1.06l1.22-1.22-1.22-1.22a.75.75 0 0 1 0-1.06Z" />
    ) : (
      <path d="M9.383 3.076A1 1 0 0 1 11 3.858v12.284a1 1 0 0 1-1.617.782L5.35 13.75H3.5A1.5 1.5 0 0 1 2 12.25v-4.5a1.5 1.5 0 0 1 1.5-1.5h1.85l4.033-3.174Zm5.802 2.739a.75.75 0 0 1 1.06 0 5.25 5.25 0 0 1 0 7.425.75.75 0 1 1-1.06-1.06 3.75 3.75 0 0 0 0-5.305.75.75 0 0 1 0-1.06Zm-2.12 2.12a.75.75 0 0 1 1.06 0 2.25 2.25 0 0 1 0 3.18.75.75 0 1 1-1.06-1.06.75.75 0 0 0 0-1.06.75.75 0 0 1 0-1.06Z" />
    )}
  </svg>
);

const FullscreenIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3.75 2A1.75 1.75 0 0 0 2 3.75v3a.75.75 0 0 0 1.5 0v-3a.25.25 0 0 1 .25-.25h3a.75.75 0 0 0 0-1.5h-3Zm9.5 0a.75.75 0 0 0 0 1.5h3a.25.25 0 0 1 .25.25v3a.75.75 0 0 0 1.5 0v-3A1.75 1.75 0 0 0 16.25 2h-3Zm-10.5 10.5a.75.75 0 0 0-.75.75v3A1.75 1.75 0 0 0 3.75 18h3a.75.75 0 0 0 0-1.5h-3a.25.25 0 0 1-.25-.25v-3a.75.75 0 0 0-.75-.75Zm14.5 0a.75.75 0 0 0-.75.75v3a.25.25 0 0 1-.25.25h-3a.75.75 0 0 0 0 1.5h3A1.75 1.75 0 0 0 18 16.25v-3a.75.75 0 0 0-.75-.75Z" />
  </svg>
);

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

const VideoPreview: React.FC<{
  asset: TestimonialAsset;
  onNaturalSize?: (size: MediaNaturalSize) => void;
}> = ({ asset, onNaturalSize }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showDrivePlayer, setShowDrivePlayer] = useState(false);
  const [hasPreviewFrame, setHasPreviewFrame] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const drivePreviewUrl = getDrivePreviewUrl(asset.public_url);
  const driveThumbnailUrl = getDriveThumbnailUrl(asset.public_url);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (drivePreviewUrl && !showDrivePlayer) {
    return (
      <button
        type="button"
        onClick={() => setShowDrivePlayer(true)}
        className="relative flex h-full min-h-[260px] w-full items-center justify-center overflow-hidden bg-zinc-950 text-white"
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
        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
        <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
          Vídeo
        </span>
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-zinc-950 shadow-2xl transition-transform duration-200 hover:scale-105">
          <PlayIcon className="ml-1 h-8 w-8" />
        </span>
        <span className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/55 px-4 py-3 text-left text-white shadow-lg backdrop-blur-md">
          <span className="block text-sm font-black">Abrir player</span>
          <span className="mt-0.5 block text-xs font-medium text-white/65">Controles completos do Google Drive</span>
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

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    video.volume = volume;
    video.muted = isMuted;
    if (video.videoWidth && video.videoHeight) {
      const naturalSize = { width: video.videoWidth, height: video.videoHeight };
      mediaSizeCache.set(asset.id, naturalSize);
      onNaturalSize?.(naturalSize);
    }
    if (Number.isFinite(video.duration) && video.duration > 0.4 && video.currentTime < 0.05) {
      try {
        video.currentTime = Math.min(0.35, video.duration * 0.12);
      } catch {
        setHasPreviewFrame(true);
      }
    } else {
      setHasPreviewFrame(true);
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Number(event.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolume = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    if (video) {
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (video) video.muted = nextMuted;
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
    <div className="group/player relative flex h-full min-h-[260px] w-full items-center justify-center overflow-hidden bg-zinc-950 text-white">
      {!hasPreviewFrame && !hasError && <ThumbnailSkeleton />}
      <video
        ref={videoRef}
        src={asset.public_url}
        className={`h-full w-full object-cover transition-opacity duration-500 ${hasPreviewFrame ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        preload="metadata"
        onClick={togglePlayback}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={() => setHasPreviewFrame(true)}
        onCanPlay={() => setHasPreviewFrame(true)}
        onSeeked={() => setHasPreviewFrame(true)}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onError={() => setHasError(true)}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-16 opacity-100 transition-opacity duration-200 sm:opacity-95 sm:group-hover/player:opacity-100">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/45 p-3 shadow-2xl backdrop-blur-md">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            aria-label={`Progresso de ${asset.name}`}
            className="h-1.5 w-full cursor-pointer accent-white"
            style={{ background: `linear-gradient(to right, white ${progress}%, rgba(255,255,255,.22) ${progress}%)` }}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg transition-transform active:scale-95"
              aria-label={isPlaying ? `Pausar ${asset.name}` : `Reproduzir ${asset.name}`}
            >
              {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
            </button>
            <span className="min-w-[5.6rem] text-xs font-bold tabular-nums text-white/85">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label={isMuted ? `Ativar som de ${asset.name}` : `Silenciar ${asset.name}`}
              >
                <VolumeIcon muted={isMuted || volume === 0} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                aria-label={`Volume de ${asset.name}`}
                className="hidden h-1.5 w-20 cursor-pointer accent-white sm:block"
              />
              <button
                type="button"
                onClick={handleFullscreen}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label={`Abrir ${asset.name} em tela cheia`}
              >
                <FullscreenIcon />
              </button>
            </div>
          </div>
        </div>
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

const AssetPreview: React.FC<{
  asset: TestimonialAsset;
  onNaturalSize?: (size: MediaNaturalSize) => void;
}> = ({ asset, onNaturalSize }) => {
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
        onLoad={event => {
          const naturalSize = {
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          };
          if (naturalSize.width && naturalSize.height) {
            mediaSizeCache.set(asset.id, naturalSize);
            onNaturalSize?.(naturalSize);
          }
        }}
      />
    );
  }

  if (isVideoAsset(asset)) {
    return <VideoPreview asset={asset} onNaturalSize={onNaturalSize} />;
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
    <span className="rounded-full border border-[#d7ebfb] bg-white/75 px-3 py-1 text-[11px] font-black text-[#5277a2]">
      {value}
    </span>
  );
};

const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; tone?: string }> = ({ active, onClick, children, tone = 'bg-[#20a8f5]' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-11 rounded-2xl px-4 text-sm font-black transition-all active:scale-95 ${
      active ? `${tone} text-[#082653] ring-1 ring-[#9bd8f8]` : 'border border-[#d7ebfb] bg-white/70 text-[#174579] hover:bg-white'
    }`}
  >
    {children}
  </button>
);

const StarRating: React.FC<{
  value?: number | null;
  onChange?: (value: number) => void;
  disabled?: boolean;
  compact?: boolean;
}> = ({ value, onChange, disabled, compact }) => {
  const roundedValue = Math.max(0, Math.min(5, Number(value || 0)));
  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`} aria-label={`Avaliação ${roundedValue || 0} de 5`}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= roundedValue;
        const className = `${compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} ${filled ? 'text-[#ffbf2f]' : 'text-[#b9d0e7]'} transition-colors`;
        if (!onChange) {
          return (
            <svg key={star} viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
              <path d="m10 1.9 2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 13.88l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L10 1.9Z" />
            </svg>
          );
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            disabled={disabled}
            className="rounded-full p-0.5 transition-transform hover:scale-110 disabled:cursor-wait disabled:opacity-70"
            aria-label={`Avaliar com ${star} estrela${star === 1 ? '' : 's'}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
              <path d="m10 1.9 2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 13.88l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L10 1.9Z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};

const getAssetKind = (asset: TestimonialAsset) => {
  if (isVideoAsset(asset)) return 'Vídeo';
  if (isAudioAsset(asset)) return 'Áudio';
  if (isImageAsset(asset)) return 'Imagem';
  return 'Arquivo';
};

const getPrimaryProcedure = (value?: string | null) => splitProcedures(value)[0] || null;

const getAssetFormatText = (asset: TestimonialAsset, creativeType?: string | null) =>
  `${asset.name} ${creativeType || ''}`.toLowerCase();

const getAssetFormatLabel = (asset: TestimonialAsset, creativeType?: string | null) => {
  const mondayCreativeType = String(creativeType || '').trim();
  if (mondayCreativeType) return mondayCreativeType;

  const text = getAssetFormatText(asset, creativeType);
  if (/story|stories/.test(text)) return 'Stories';
  if (/reels|9:16|vertical|depoimento/.test(text)) return 'Reels';
  if (/post|feed|carrossel|square|1:1/.test(text)) return 'Post';
  return getAssetKind(asset);
};

const getFallbackAspectRatio = (asset: TestimonialAsset, creativeType?: string | null) => {
  const text = getAssetFormatText(asset, creativeType);
  if (/reels|story|stories|9:16|vertical/.test(text)) {
    return 9 / 16;
  }
  if (/post|feed|carrossel|square|1:1/.test(text)) {
    return 1;
  }
  return 16 / 9;
};

const getAssetRatio = (asset: TestimonialAsset, creativeType?: string | null, naturalSize?: MediaNaturalSize | null) => {
  if (naturalSize?.width && naturalSize?.height) return naturalSize.width / naturalSize.height;
  return getFallbackAspectRatio(asset, creativeType);
};

const getAssetFrameClass = (
  asset: TestimonialAsset,
  creativeType?: string | null,
  naturalSize?: MediaNaturalSize | null
) => {
  const ratio = getAssetRatio(asset, creativeType, naturalSize);
  if (ratio < 0.85) return 'h-[min(72dvh,780px)] w-auto max-w-full';
  if (ratio < 1.25) return 'w-full max-w-[660px] max-h-[70dvh]';
  return 'w-full max-w-[980px] max-h-[70dvh]';
};

const getAssetFrameStyle = (
  asset: TestimonialAsset,
  creativeType?: string | null,
  naturalSize?: MediaNaturalSize | null
) => {
  const ratio = getAssetRatio(asset, creativeType, naturalSize);
  return { aspectRatio: `${ratio}` };
};

const getAssetCardHeight = (asset: TestimonialAsset, creativeType?: string | null) => {
  const text = getAssetFormatText(asset, creativeType);
  if (/reels|story|stories|9:16|vertical|depoimento/.test(text)) return 'h-[420px]';
  if (/feed|post|carrossel|square|1:1/.test(text)) return 'h-[300px]';
  if (isVideoAsset(asset)) return 'h-[380px]';
  return 'h-[330px]';
};

const ThumbnailSkeleton: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden bg-[#d8edff]" aria-hidden="true">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#dff2ff] via-[#b9dff7] to-[#eef8ff]" />
    <div className="absolute inset-x-3 top-3 flex items-center gap-2">
      <span className="h-7 w-7 rounded-xl bg-white/60" />
      <span className="h-3 w-24 rounded-full bg-white/60" />
    </div>
    <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45" />
    <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-[shimmer_1.35s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/55 to-transparent" />
    <div className="absolute inset-x-4 bottom-5 space-y-2">
      <span className="block h-4 w-2/3 rounded-full bg-white/60" />
      <span className="block h-3 w-1/3 rounded-full bg-white/50" />
    </div>
  </div>
);

const VideoThumbnail: React.FC<{ asset: TestimonialAsset; className?: string }> = ({ asset, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const driveThumbnailUrl = getDriveThumbnailUrl(asset.public_url);

  useEffect(() => {
    setIsReady(false);
    setHasError(false);
    setImageLoaded(false);
  }, [asset.public_url]);

  if (driveThumbnailUrl) {
    return (
      <div className={`relative h-full w-full overflow-hidden bg-[#d8edff] ${className}`}>
        {!imageLoaded && <ThumbnailSkeleton />}
        <img
          src={driveThumbnailUrl}
          alt=""
          width={800}
          height={1200}
          className={`h-full w-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          decoding="async"
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />
      </div>
    );
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth && video.videoHeight) {
      mediaSizeCache.set(asset.id, { width: video.videoWidth, height: video.videoHeight });
    }
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration > 0.4) {
      try {
        video.currentTime = Math.min(0.35, duration * 0.12);
      } catch {
        setIsReady(true);
      }
    } else {
      setIsReady(true);
    }
  };

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br from-[#082653] via-[#1f78ba] to-[#bdefff] ${className}`}>
      {!isReady && !hasError && <ThumbnailSkeleton />}
      {!hasError && (
        <video
          ref={videoRef}
          src={asset.public_url}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => setIsReady(true)}
          onSeeked={() => setIsReady(true)}
          onError={() => setHasError(true)}
          aria-hidden="true"
        />
      )}
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(to_top,rgba(8,38,83,0.42),rgba(8,38,83,0.04))]" />
    </div>
  );
};

const GalleryAssetPreview: React.FC<{ asset: TestimonialAsset; className?: string }> = ({ asset, className = '' }) => {
  if (isImageAsset(asset)) {
    return (
      <img
        src={asset.public_url}
        alt={asset.name}
        width={800}
        height={1200}
        className={`h-full w-full object-cover ${className}`}
        decoding="async"
        loading="lazy"
      />
    );
  }

  if (isVideoAsset(asset)) {
    return (
      <div className={`relative h-full w-full bg-[#082653] ${className}`}>
        <VideoThumbnail asset={asset} />
        <span className="absolute inset-0 bg-black/16" />
        <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/88 px-3 text-[11px] font-black text-[#082653] backdrop-blur">
          <PlayIcon className="h-3.5 w-3.5" />
          Vídeo
        </span>
      </div>
    );
  }

  if (isAudioAsset(asset)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#082653] to-[#20a8f5] text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-10 w-10" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <span className="text-xs font-black uppercase tracking-widest">Áudio</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white/70 text-[#5277a2]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-10 w-10" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-.988-2.386l-4.751-4.751A3.375 3.375 0 0 0 11.375 3.5H8.25A2.25 2.25 0 0 0 6 5.75v12.5a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-4Z" />
      </svg>
      <span className="text-xs font-black uppercase tracking-widest">Arquivo</span>
    </div>
  );
};

const ReadyAssetModal: React.FC<{
  item: ReadyGalleryItem;
  recommendations: ReadyGalleryItem[];
  token: string;
  isDemo?: boolean;
  onClose: () => void;
  onSelect: (item: ReadyGalleryItem) => void;
  onOpenCase?: (caseId: string) => void;
  onRated: (subitemId: string, rating: number) => void;
}> = ({ item, recommendations, token, isDemo, onClose, onSelect, onOpenCase, onRated }) => {
  const { testimonial } = item;
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [ratingDraft, setRatingDraft] = useState(testimonial.rating || 0);
  const [isRatingSaving, setIsRatingSaving] = useState(false);
  const asset = item.assets[selectedAssetIndex] || item.primaryAsset;
  const [naturalSize, setNaturalSize] = useState<MediaNaturalSize | null>(() => mediaSizeCache.get(asset.id) || null);
  const visibleRecommendations = recommendations.slice(0, 12);
  const procedure = getPrimaryProcedure(testimonial.patientProcedure);
  const formatLabel = getAssetFormatLabel(asset, testimonial.creativeType);

  useEffect(() => {
    setSelectedAssetIndex(0);
  }, [item.id]);

  useEffect(() => {
    setRatingDraft(testimonial.rating || 0);
  }, [testimonial.rating, testimonial.subitemId]);

  useEffect(() => {
    setNaturalSize(mediaSizeCache.get(asset.id) || null);
  }, [asset.id]);

  const handleRatingChange = async (nextRating: number) => {
    setRatingDraft(nextRating);
    if (isDemo) return;
    setIsRatingSaving(true);
    try {
      await updateReadyTestimonialRating(token, testimonial, nextRating);
      onRated(testimonial.subitemId, nextRating);
    } catch (error) {
      console.error('[ReadyTestimonials] Falha ao avaliar criativo.', error);
    } finally {
      setIsRatingSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[73px] z-[90] overflow-y-auto bg-[#f4faff] px-3 py-4 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizar ${testimonial.title}`}
    >
      <div className="mx-auto max-w-[1660px]">
        <div className="grid gap-5 xl:grid-cols-[minmax(640px,1fr)_470px] 2xl:grid-cols-[minmax(720px,1fr)_520px]">
          <main className="min-w-0">
            <div className="impact-glass rounded-[2rem] p-3 sm:p-5">
              <div className="mb-4 flex flex-col gap-4 rounded-[1.55rem] border border-white/80 bg-white/55 p-4 shadow-[0_14px_36px_rgba(22,78,129,0.08)] lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c7e6fb] bg-white/88 text-[#082653] transition-colors hover:bg-white active:scale-95"
                    aria-label="Voltar para materiais"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.78 4.22a.75.75 0 0 1 0 1.06L5.06 8h10.19a.75.75 0 0 1 0 1.5H5.06l2.72 2.72a.75.75 0 1 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#d9edff] text-sm font-black text-[#1b72b6]">
                    {testimonial.patientName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-[#082653]">{testimonial.patientName}</h2>
                    <p className="mt-0.5 truncate text-xs font-bold text-[#5d7ca4]">
                      {[testimonial.patientAge ? `${testimonial.patientAge} anos` : null, procedure, formatLabel].filter(Boolean).join(' • ')}
                    </p>
                    <div className="mt-1.5">
                      <StarRating value={ratingDraft} onChange={handleRatingChange} disabled={isRatingSaving} />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:justify-end">
                  {onOpenCase && (
                    <button
                      type="button"
                      onClick={() => onOpenCase(testimonial.caseId)}
                      className="impact-secondary min-h-10 flex-1 px-4 text-xs sm:flex-none"
                    >
                      Ver caso
                    </button>
                  )}
                  <a
                    href={getDownloadUrl(token, testimonial, asset, isDemo)}
                    download={asset.name}
                    className="impact-primary min-h-10 flex-1 px-4 text-xs sm:flex-none"
                  >
                    Download
                  </a>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[#c9e7fb] bg-gradient-to-br from-[#dff2ff] via-white to-[#e7f6ff] p-3 shadow-inner sm:p-4">
                <div
                  className={`relative mx-auto flex items-center justify-center overflow-hidden rounded-[1.35rem] bg-[#06182f] shadow-[0_24px_70px_rgba(8,38,83,0.22)] ${getAssetFrameClass(asset, testimonial.creativeType, naturalSize)}`}
                  style={getAssetFrameStyle(asset, testimonial.creativeType, naturalSize)}
                >
                  <AssetPreview asset={asset} onNaturalSize={setNaturalSize} />
                  <span className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs font-black text-white backdrop-blur">
                    {item.isPhotoCatalog ? `${item.assets.length} fotos` : formatLabel}
                  </span>
                  <button
                    type="button"
                    className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
                    aria-label="Mais opções"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                      <path d="M5.25 10a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm6 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm4.75 1.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
                    </svg>
                  </button>
                </div>
              </div>

              {item.isPhotoCatalog && item.assets.length > 1 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {item.assets.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedAssetIndex(index)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition-all ${
                        selectedAssetIndex === index ? 'border-[#20a8f5] shadow-[0_10px_28px_rgba(32,168,245,0.22)]' : 'border-white/80 opacity-70 hover:opacity-100'
                      }`}
                      aria-label={`Ver foto ${index + 1}`}
                    >
                      <GalleryAssetPreview asset={photo} />
                    </button>
                  ))}
                </div>
              )}

            </div>
          </main>

          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <div className="impact-glass rounded-[2rem] p-4">
              <div className="grid grid-cols-2 gap-3">
                {visibleRecommendations.map(recommended => {
                  const recProcedure = getPrimaryProcedure(recommended.testimonial.patientProcedure);
                  return (
                    <button
                      key={recommended.id}
                      type="button"
                      onClick={() => onSelect(recommended)}
                      className="group overflow-hidden rounded-[1.25rem] border border-[#d7ebfb] bg-white/75 text-left shadow-[0_12px_30px_rgba(22,78,129,0.1)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(22,78,129,0.16)]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-b-[1.05rem]">
                        <GalleryAssetPreview asset={recommended.primaryAsset} />
                        {isVideoAsset(recommended.primaryAsset) && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/88 text-[#082653] shadow-lg">
                              <PlayIcon className="ml-0.5 h-5 w-5" />
                            </span>
                          </span>
                        )}
                        {recommended.isPhotoCatalog && (
                          <span className="absolute right-2 top-2 rounded-full bg-white/88 px-2.5 py-1 text-[10px] font-black text-[#082653] backdrop-blur">
                            {recommended.assets.length} fotos
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 px-3 py-3">
                        <p className="truncate text-xs font-black text-[#082653]">{recommended.testimonial.patientName}</p>
                        <p className="truncate text-[11px] font-bold text-[#5277a2]">
                          {[recommended.testimonial.patientAge ? `${recommended.testimonial.patientAge} anos` : null, recProcedure].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {visibleRecommendations.length === 0 && (
                <div className="rounded-[1.4rem] border border-dashed border-[#b9dff7] bg-white/55 p-8 text-center text-sm font-bold text-[#5d7ca4]">
                  Ainda não há outros materiais para recomendar.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const ReadyTestimonials: React.FC<ReadyTestimonialsProps> = ({ token, clientName, isDemo, initialSearch = '', onBack, onOpenCase }) => {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterProcedure, setFilterProcedure] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [filterCreativeType, setFilterCreativeType] = useState('all');
  const [ratingOverrides, setRatingOverrides] = useState<Record<string, number>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReadyGalleryItem | null>(null);
  const { testimonials, totalAssets, isLoading, isRefreshing, error, refresh } = useReadyTestimonials(token, isDemo);

  const ratedTestimonials = useMemo(
    () => testimonials.map(item => ({
      ...item,
      rating: ratingOverrides[item.subitemId] ?? item.rating ?? null,
    })),
    [ratingOverrides, testimonials]
  );

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (!selectedItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  const procedures = useMemo(() => {
    const set = new Set<string>();
    ratedTestimonials.forEach(t => splitProcedures(t.patientProcedure).forEach(proc => set.add(proc)));
    return Array.from(set).sort();
  }, [ratedTestimonials]);

  const creativeTypes = useMemo(() => {
    const set = new Set<string>();
    ratedTestimonials.forEach(item => {
      const creativeType = String(item.creativeType || '').trim();
      if (creativeType) set.add(creativeType);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [ratedTestimonials]);

  const filteredTestimonials = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return ratedTestimonials.filter(item => {
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
  }, [deferredSearch, ratedTestimonials, filterProcedure, filterGender, filterCreativeType, filterAge]);

  const galleryItems = useMemo<ReadyGalleryItem[]>(
    () => buildReadyGalleryItems(filteredTestimonials),
    [filteredTestimonials]
  );

  const allGalleryItems = useMemo<ReadyGalleryItem[]>(
    () => buildReadyGalleryItems(ratedTestimonials),
    [ratedTestimonials]
  );

  const recommendedItems = useMemo(() => {
    if (!selectedItem) return [];
    return sortReadyRecommendations(allGalleryItems, selectedItem);
  }, [allGalleryItems, selectedItem]);

  const suggestedFilters = useMemo(() => {
    const items = [
      { value: 'all', label: 'Todos os casos', tone: 'bg-[#dff2ff]' },
      ...procedures.slice(0, 5).map((procedure, index) => ({
        value: procedure,
        label: procedure,
        tone: ['bg-[#c7f9e5]', 'bg-[#ffcfda]', 'bg-[#ffefba]', 'bg-[#cce8ff]', 'bg-[#e3d8ff]'][index % 5],
      })),
    ];
    return items;
  }, [procedures]);

  const hasActiveFilters = filterProcedure !== 'all' || filterGender !== 'all' || filterAge !== 'all' || filterCreativeType !== 'all';

  return (
    <section className="animate-fade-in">
      <div className="mb-4 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d7ebfb] bg-white/72 text-[#082653] transition-colors hover:bg-white active:scale-95"
            aria-label="Voltar para casos"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">{clientName}</p>
          <h1 className="truncate text-2xl font-black tracking-tight text-[#082653] sm:text-3xl">Materiais prontos</h1>
        </div>
      </div>

      <div className="rounded-[2rem] border border-[#d7ebfb] bg-white/52 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6d91bb]">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              name="testimonial-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              autoComplete="off"
              placeholder="Buscar por paciente, procedimento ou caso..."
              className="h-12 w-full rounded-[1.35rem] border border-[#cfe8fb] bg-white/78 py-3 pl-12 pr-4 text-sm font-semibold text-[#123762] outline-none transition-colors placeholder:text-[#7d9bbd] focus:border-[#7bcdfb] focus:ring-2 focus:ring-[#20a8f5]/15"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            <button
              type="button"
              onClick={() => setFiltersOpen(open => !open)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-xs font-black transition-all ${
                filtersOpen || hasActiveFilters ? 'border-[#082653] bg-[#082653] text-white' : 'border-[#9fd7f7] bg-[#e8f6ff] text-[#082653] hover:bg-white'
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
              </svg>
              Filtros
            </button>

            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing || isLoading}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-[#9fd7f7] bg-[#e8f6ff] px-4 text-xs font-black text-[#082653] transition-all hover:bg-white disabled:opacity-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466.75.75 0 0 0-1.061 1.061 7 7 0 0 0 11.713-3.138.75.75 0 0 0-1.451-.389ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466.75.75 0 1 0 1.061-1.061A7 7 0 0 0 3.237 8.187a.75.75 0 1 0 1.451.389Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.75 8.25A.75.75 0 0 1 6 9H3.25a.75.75 0 0 1-.75-.75V5.5a.75.75 0 0 1 1.5 0v1.19l1.22-1.22a.75.75 0 0 1 1.06 1.06L5.06 7.75H6a.75.75 0 0 1 .75.5Zm6.5 3.5A.75.75 0 0 1 14 11h2.75a.75.75 0 0 1 .75.75v2.75a.75.75 0 0 1-1.5 0v-1.19l-1.22 1.22a.75.75 0 1 1-1.06-1.06l1.22-1.22H14a.75.75 0 0 1-.75-.5Z" clipRule="evenodd" />
              </svg>
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {suggestedFilters.map(filter => (
            <FilterChip
              key={filter.value}
              active={filterProcedure === filter.value}
              tone={filter.tone}
              onClick={() => setFilterProcedure(filter.value)}
            >
              {filter.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtersOpen && (
        <div className="mt-5 rounded-[1.7rem] border border-[#d7ebfb] bg-white/58 p-5 backdrop-blur-xl">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#20a8f5]">Gênero</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'Feminino', label: 'Feminino' },
                  { value: 'Masculino', label: 'Masculino' },
                  { value: 'Pref. não informar', label: 'Outro' },
                ].map(opt => (
                  <FilterChip key={opt.value} active={filterGender === opt.value} onClick={() => setFilterGender(opt.value)} tone="bg-[#dff2ff]">
                    {opt.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#20a8f5]">Faixa etária</p>
              <div className="flex flex-wrap gap-2">
                {ageRanges.map(opt => (
                  <FilterChip key={opt.value} active={filterAge === opt.value} onClick={() => setFilterAge(opt.value)} tone="bg-[#c7f9e5]">
                    {opt.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#20a8f5]">Procedimento</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={filterProcedure === 'all'} onClick={() => setFilterProcedure('all')} tone="bg-[#dff2ff]">Todos</FilterChip>
                {procedures.map(proc => (
                  <FilterChip key={proc} active={filterProcedure === proc} onClick={() => setFilterProcedure(proc)} tone="bg-[#ffefba]">
                    {proc}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#20a8f5]">Tipo de criativo</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={filterCreativeType === 'all'} onClick={() => setFilterCreativeType('all')} tone="bg-[#dff2ff]">Todos</FilterChip>
                {creativeTypes.map(type => (
                  <FilterChip key={type} active={filterCreativeType === type} onClick={() => setFilterCreativeType(type)} tone="bg-[#e3d8ff]">
                    {type}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setFilterProcedure('all');
                setFilterGender('all');
                setFilterAge('all');
                setFilterCreativeType('all');
              }}
              className="mt-5 text-xs font-black text-[#5277a2] underline underline-offset-2 hover:text-[#082653]"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      )}

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
      ) : !isLoading && galleryItems.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-zinc-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-zinc-900">Nenhum material pronto</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {(search.trim() || hasActiveFilters) ? 'Tente ajustar os filtros ou busca.' : 'Quando houver arquivos nos subelementos do Monday, eles aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {galleryItems.map(item => {
            const procedure = getPrimaryProcedure(item.testimonial.patientProcedure);
            const formatLabel = getAssetFormatLabel(item.primaryAsset, item.testimonial.creativeType);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className={`group relative w-full overflow-hidden rounded-[1.35rem] border border-white/75 bg-[#d8edff] text-left shadow-[0_10px_28px_rgba(22,78,129,0.1)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(22,78,129,0.14)] ${getAssetCardHeight(item.primaryAsset, item.testimonial.creativeType)}`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '340px' }}
                aria-label={`Abrir ${item.testimonial.title} de ${item.testimonial.patientName}`}
              >
                <GalleryAssetPreview asset={item.primaryAsset} />

                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-[#06182f]/65 to-transparent p-3 pb-12">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/78 text-[#2b75bd] backdrop-blur">
                      {isVideoAsset(item.primaryAsset) ? (
                        <PlayIcon className="ml-0.5 h-3.5 w-3.5" />
                      ) : (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                          <path fillRule="evenodd" d="M4.25 3A2.25 2.25 0 0 0 2 5.25v9.5A2.25 2.25 0 0 0 4.25 17h11.5A2.25 2.25 0 0 0 18 14.75v-9.5A2.25 2.25 0 0 0 15.75 3H4.25Zm.28 10.72 2.47-2.47a1.5 1.5 0 0 1 2.12 0l.88.88 2.13-2.13a1.5 1.5 0 0 1 2.12 0l1.25 1.25v3.5a.25.25 0 0 1-.25.25H4.25a.25.25 0 0 1-.25-.25v-.5l.53-.53Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0 text-white">
                      <p className="truncate text-[11px] font-black">{item.testimonial.patientName}</p>
                      <p className="mt-0.5 truncate text-[10px] font-bold text-white/78">
                        {[item.testimonial.patientAge ? `${item.testimonial.patientAge} anos` : null, procedure].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  </div>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/24 text-white backdrop-blur">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m10 3.2 1.86 3.77 4.16.61-3.01 2.93.71 4.14L10 12.7l-3.72 1.95.71-4.14-3.01-2.93 4.16-.61L10 3.2Z" />
                    </svg>
                  </span>
                </div>

                {isVideoAsset(item.primaryAsset) && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/88 text-[#082653] shadow-[0_18px_40px_rgba(8,38,83,0.28)] backdrop-blur transition-transform group-hover:scale-105">
                      <PlayIcon className="ml-1 h-7 w-7" />
                    </span>
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/95 via-white/70 to-transparent p-4 pt-24">
                  <p className="line-clamp-2 text-lg font-serif leading-tight text-[#42699a]">
                    {item.testimonial.title || item.testimonial.mondayItemName}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#eaf6ff] px-2.5 py-1 text-[10px] font-black text-[#2b75bd]">
                      {item.isPhotoCatalog ? `${item.assets.length} fotos` : formatLabel}
                    </span>
                    <StarRating value={item.testimonial.rating} compact />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#8aa8c6]">
                      Abrir
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <ReadyAssetModal
          item={selectedItem}
          recommendations={recommendedItems}
          token={token}
          isDemo={isDemo}
          onClose={() => setSelectedItem(null)}
          onSelect={setSelectedItem}
          onOpenCase={onOpenCase}
          onRated={(subitemId, rating) => setRatingOverrides(prev => ({ ...prev, [subitemId]: rating }))}
        />
      )}
    </section>
  );
};

export default ReadyTestimonials;
