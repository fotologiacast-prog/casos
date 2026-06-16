import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaseStage, CaseStageMoment } from '../../types';
import { UploadProgressInfo } from '../../services/driveUploadService';
import { useStageFaqs } from './useStageFaqs';

interface CaseStageCardProps {
  index: number;
  stage: CaseStage;
  onUpload: (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => Promise<void>;
  onFileDeleted?: (stageId: string, fileId: string) => void;
  isPlaceholder?: boolean;
}

const isImageFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|jfif|gif|webp|bmp|tiff?|svg|heic|heif|avif|raw|dng|cr2|cr3|nef|arw|raf|orf|rw2|pef|srw|x3f|iiq|kdc|dcr|mrw)$/i.test(file.name);
};

const isBrowserImageFile = (file: CaseStage['files'][number]) => {
  if (/^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|avif)$/i.test(file.type || '')) return true;
  return /\.(png|jpe?g|jfif|gif|webp|bmp|svg|avif)$/i.test(file.name);
};

const isVideoFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('video/')) return true;
  return /\.(mp4|m4v|mov|qt|webm|avi|mkv|mpeg|mpg|3gp|3g2|mts|m2ts|ts|wmv|flv|f4v|ogv|mxf|hevc|h265|prores)$/i.test(file.name);
};

const isAudioFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('audio/')) return true;
  return /\.(mp3|m4a|aac|wav|wave|aiff?|flac|ogg|oga|opus|wma|amr|caf|alac)$/i.test(file.name);
};

const isExampleVideo = (url: string) =>
  /\.(mp4|m4v|mov|webm|avi|mkv|mpeg|mpg|3gp|wmv|ogv)(\?|$)/i.test(url);

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

const getDriveThumbnailUrl = (file: CaseStage['files'][number]) => {
  const fileId = getDriveFileIdFromUrl(file.public_url);
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w800` : null;
};

const getDrivePreviewUrl = (url: string) => {
  const fileId = getDriveFileIdFromUrl(url);
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : null;
};

const UPLOAD_ACCEPT = [
  'image/*',
  'video/*',
  'audio/*',
  '.mp4',
  '.m4v',
  '.mov',
  '.qt',
  '.webm',
  '.avi',
  '.mkv',
  '.mpeg',
  '.mpg',
  '.3gp',
  '.3g2',
  '.mts',
  '.m2ts',
  '.ts',
  '.wmv',
  '.flv',
  '.f4v',
  '.ogv',
  '.mxf',
  '.hevc',
  '.h265',
  '.prores',
  '.mp3',
  '.m4a',
  '.aac',
  '.wav',
  '.aiff',
  '.aif',
  '.flac',
  '.ogg',
  '.oga',
  '.opus',
  '.wma',
  '.amr',
  '.caf',
  '.alac',
  '.heic',
  '.heif',
  '.avif',
  '.raw',
  '.dng',
  '.cr2',
  '.cr3',
  '.nef',
  '.arw',
  '.raf',
  '.orf',
  '.rw2',
  '.pef',
  '.srw',
  '.x3f',
  '.iiq',
  '.kdc',
  '.dcr',
  '.mrw',
].join(',');

const momentCapturedTheme: Record<string, {
  border: string;
  hoverBorder: string;
  ring: string;
  shadow: string;
  icon: string;
  text: string;
  buttonText: string;
  uploadButton: string;
}> = {
  Planejamento: {
    border: 'border-emerald-300',
    hoverBorder: 'hover:border-emerald-400',
    ring: 'ring-emerald-100',
    shadow: 'shadow-[0_16px_44px_rgba(16,185,129,0.16)]',
    icon: 'bg-emerald-50 text-emerald-600',
    text: 'text-emerald-600',
    buttonText: 'text-emerald-600 hover:text-emerald-700',
    uploadButton: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
  },
  Procedimento: {
    border: 'border-amber-300',
    hoverBorder: 'hover:border-amber-400',
    ring: 'ring-amber-100',
    shadow: 'shadow-[0_14px_40px_rgba(245,158,11,0.16)]',
    icon: 'bg-amber-100 text-amber-600',
    text: 'text-amber-600',
    buttonText: 'text-amber-600 hover:text-amber-700',
    uploadButton: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
  },
  Entrega: {
    border: 'border-rose-300',
    hoverBorder: 'hover:border-rose-400',
    ring: 'ring-rose-100',
    shadow: 'shadow-[0_14px_40px_rgba(244,63,94,0.14)]',
    icon: 'bg-rose-100 text-rose-600',
    text: 'text-rose-600',
    buttonText: 'text-rose-600 hover:text-rose-700',
    uploadButton: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20',
  },
  Evento: {
    border: 'border-sky-300',
    hoverBorder: 'hover:border-sky-400',
    ring: 'ring-sky-100',
    shadow: 'shadow-[0_14px_40px_rgba(14,165,233,0.15)]',
    icon: 'bg-sky-100 text-sky-600',
    text: 'text-sky-600',
    buttonText: 'text-sky-600 hover:text-sky-700',
    uploadButton: 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/20',
  },
  Agência: {
    border: 'border-violet-300',
    hoverBorder: 'hover:border-violet-400',
    ring: 'ring-violet-100',
    shadow: 'shadow-[0_14px_40px_rgba(139,92,246,0.15)]',
    icon: 'bg-violet-100 text-violet-600',
    text: 'text-violet-600',
    buttonText: 'text-violet-600 hover:text-violet-700',
    uploadButton: 'bg-violet-500 hover:bg-violet-600 shadow-violet-500/20',
  },
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const AudioIcon = ({ className = 'h-8 w-8' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const AttachmentIcon = ({ className = 'h-8 w-8' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m21.44 11.05-8.49 8.49a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const WarningIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" d="M8.485 2.495a1.75 1.75 0 0 1 3.03 0l6.28 10.99A1.75 1.75 0 0 1 16.28 16.1H3.72a1.75 1.75 0 0 1-1.515-2.615l6.28-10.99ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
  </svg>
);

const getUploadLabel = (progress: UploadProgressInfo | null) => {
  if (!progress) return 'Preparando upload...';
  if (progress.phase === 'preparing') return 'Preparando upload...';
  if (progress.phase === 'reconnecting') return 'Reconectando...';
  if (progress.phase === 'resuming') return `Retomando de ${progress.percentage}%`;
  if (progress.phase === 'saving') return 'Finalizando no Drive...';
  return `Enviando... ${progress.percentage}%`;
};

const getUploadDetail = (progress: UploadProgressInfo | null) => {
  if (!progress) return null;
  const filePrefix = progress.fileName
    ? `${progress.fileIndex && progress.fileCount ? `${progress.fileIndex}/${progress.fileCount} · ` : ''}${progress.fileName}`
    : null;
  const size = `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`;
  return filePrefix ? `${filePrefix} · ${size}` : size;
};

const MediaFallback = ({ label }: { file: CaseStage['files'][number]; label: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-950 p-5 text-center text-white">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
      </svg>
    </div>
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-zinc-300">{label}</p>
      <p className="mt-2 text-[10px] font-semibold leading-relaxed text-zinc-500">
        Arquivo recebido no Drive, mas sem prévia compatível no navegador.
      </p>
    </div>
  </div>
);

const DriveImage = ({
  file,
  className,
  onClick,
  preferThumbnail = false,
  thumbnailOnly = false,
}: {
  file: CaseStage['files'][number];
  className: string;
  onClick?: () => void;
  preferThumbnail?: boolean;
  thumbnailOnly?: boolean;
}) => {
  const thumbnailUrl = getDriveThumbnailUrl(file);
  const getInitialSrc = () => {
    if (preferThumbnail && thumbnailUrl) return thumbnailUrl;
    if (isBrowserImageFile(file)) return file.public_url;
    return thumbnailUrl;
  };
  const [src, setSrc] = useState<string | null>(getInitialSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(getInitialSrc());
    setFailed(false);
  }, [file.id, file.public_url, file.type, preferThumbnail, thumbnailOnly, thumbnailUrl]);

  if (!src || failed) {
    return <MediaFallback file={file} label="Preview indisponível" />;
  }

  return (
    <img
      src={src}
      alt={file.name || 'Arquivo enviado'}
      width={800}
      height={800}
      className={className}
      onClick={onClick}
      onError={() => {
        if (src !== thumbnailUrl && thumbnailUrl) setSrc(thumbnailUrl);
        else if (!thumbnailOnly && src !== file.public_url && isBrowserImageFile(file)) setSrc(file.public_url);
        else setFailed(true);
      }}
      decoding="async"
      loading="lazy"
    />
  );
};

const DriveThumbnailImage = ({ file, className }: { file: CaseStage['files'][number]; className: string }) => {
  const directThumbnailUrl = getDriveThumbnailUrl(file);
  const [src, setSrc] = useState(directThumbnailUrl);

  useEffect(() => {
    setSrc(directThumbnailUrl);
  }, [directThumbnailUrl]);

  if (!src) return <div className="h-full w-full bg-zinc-900" />;

  return (
    <img
      src={src}
      alt={file.name || 'Miniatura do arquivo'}
      width={800}
      height={800}
      className={className}
      decoding="async"
      loading="lazy"
      onError={() => setSrc(null)}
    />
  );
};

const VideoTile = ({ file, onClick }: { file: CaseStage['files'][number]; onClick: () => void }) => {
  const thumbnailUrl = getDriveThumbnailUrl(file);
  return (
    <button type="button" onClick={onClick} className="relative h-full w-full bg-zinc-950 text-white" aria-label={`Abrir video ${file.name}`}>
      {thumbnailUrl ? (
        <DriveThumbnailImage file={file} className="h-full w-full object-cover opacity-85" />
      ) : (
        <div className="h-full w-full bg-zinc-900" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow-lg">
          <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 h-6 w-6">
            <path d="M6.3 3.84A1 1 0 0 0 4.75 4.67v10.66a1 1 0 0 0 1.55.83l8-5.33a1 1 0 0 0 0-1.66l-8-5.33Z" />
          </svg>
        </span>
      </span>
    </button>
  );
};

const VideoPlayer = ({ file, className, controls, autoPlay, muted, onClick }: any) => {
  const [hasError, setHasError] = useState(false);
  const drivePreviewUrl = getDrivePreviewUrl(file.public_url);
  if (drivePreviewUrl) {
    return (
      <iframe
        src={drivePreviewUrl}
        className={`${className} aspect-video w-full bg-black`}
        allow="autoplay; fullscreen"
        allowFullScreen
        title={file.name}
      />
    );
  }

  if (hasError) {
    return <MediaFallback file={file} label="Vídeo não reproduzível neste navegador" />;
  }
  return (
    <video
      src={file.public_url}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      playsInline
      preload="metadata"
      poster={getDriveThumbnailUrl(file) || undefined}
      onClick={onClick}
      onError={() => setHasError(true)}
    />
  );
};

const CaseStageCard: React.FC<CaseStageCardProps> = ({ index, stage, onUpload, isPlaceholder, onFileDeleted }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxFile, setLightboxFile] = useState<CaseStage['files'][number] | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const stageType = stage.title;
  const { faqs, isLoading: faqLoading, loadFaqs } = useStageFaqs(stageType);

  useEffect(() => {
    if (!isUploading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  useEffect(() => {
    if (!faqOpen && !lightboxFile) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFaqOpen(false);
      setLightboxFile(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [faqOpen, lightboxFile]);

  const handleToggleExpand = async () => {
    setIsExpanded(prev => !prev);
  };

  const handleOpenFaq = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setFaqOpen(true);
    await loadFaqs();
  };

  const isCaptured = stage.status === 'Capturado' || stage.files.length > 0;
  const stageNumber = index >= 0 ? index + 1 : null;
  const lightboxIndex = lightboxFile ? stage.files.findIndex(file => file.id === lightboxFile.id) : -1;
  const canNavigateLightbox = lightboxIndex >= 0 && stage.files.length > 1;
  const goToLightboxFile = (direction: -1 | 1) => {
    if (!canNavigateLightbox) return;
    const nextIndex = (lightboxIndex + direction + stage.files.length) % stage.files.length;
    setLightboxFile(stage.files[nextIndex]);
  };
  const isUsageLocked = Boolean(stage.usageLock);
  const moment = (stage.moment || stage.title) as CaseStageMoment;
  const capturedTheme = momentCapturedTheme[moment] || momentCapturedTheme.Planejamento;
  const handleFiles = async (files: File[]) => {
    if (files.length === 0 || isPlaceholder) return;
    if (isUsageLocked) {
      setError('Este material ja foi utilizado pela edicao e nao aceita novos uploads.');
      return;
    }
    setError(null);
    setIsUploading(true);
    setUploadProgress(null);
    try {
      await onUpload(stage, files, (info) => setUploadProgress(info));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar arquivos.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    event.target.value = '';
    await handleFiles(files);
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (isPlaceholder) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isUsageLocked) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (isPlaceholder) return;
    if (isUsageLocked) {
      setError('Este material ja foi utilizado pela edicao e nao aceita novos uploads.');
      return;
    }
    const files = Array.from(event.dataTransfer.files) as File[];
    await handleFiles(files);
  };

  const handleDeleteFile = async (file: CaseStage['files'][number]) => {
    if (isUsageLocked) {
      setError('Este material ja foi utilizado pela edicao e nao pode mais ser removido.');
      return;
    }
    if (!window.confirm(`Remover "${file.name}" permanentemente do Drive e do sistema?`)) return;
    setDeletingFileId(file.id);
    try {
      const response = await fetch('/api/drive', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId: (file as any).drive_file_id || null,
          caseFileId: file.id,
          stageId: stage.id,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.details || data.error || 'Falha ao remover arquivo.');
      }
      if (onFileDeleted) onFileDeleted(stage.id, file.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover arquivo.');
    } finally {
      setDeletingFileId(null);
    }
  };

  return (
    <div
      id={`stage-${stage.id}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative overflow-hidden rounded-[1.35rem] transition-all duration-300 sm:rounded-[1.55rem] lg:rounded-[1.75rem] ${
        isCaptured
          ? `bg-white/80 border-2 ${capturedTheme.border} ${capturedTheme.shadow} ring-1 ${capturedTheme.ring}`
          : 'border border-white/75 bg-white/70 shadow-[0_12px_34px_rgba(22,78,129,0.1)] backdrop-blur-xl'
      } ${isExpanded ? `ring-2 ${capturedTheme.ring}` : isCaptured ? capturedTheme.hoverBorder : 'hover:border-[#cde8fb]'}`}
    >
      <input ref={inputRef} type="file" multiple accept={UPLOAD_ACCEPT} onChange={handleInputChange} className="hidden" disabled={isUsageLocked} />
      <div 
        className="flex cursor-pointer items-center gap-3.5 px-5 py-4 transition-colors hover:bg-white/50 sm:gap-4 sm:px-6 sm:py-5 lg:gap-5 lg:px-7 lg:py-6"
        onClick={handleToggleExpand}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggleExpand();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`stage-panel-${stage.id}`}
      >
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9),0_8px_22px_rgba(22,78,129,0.1)] transition-all sm:h-14 sm:w-14 lg:rounded-[1.25rem] ${
          isCaptured ? capturedTheme.icon : 'bg-white/70 text-[#7d9bbd]'
        }`}>
          {isCaptured ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="truncate text-[0.95rem] font-black tracking-tight text-[#082653] sm:text-base lg:text-lg">
            {stageNumber ? `${stageNumber}. ` : ''}{stage.title}
          </h3>
          {isUsageLocked ? (
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500 lg:text-[11px]">Utilizado pela edição · bloqueado</p>
          ) : isCaptured ? (
            <p className={`text-[10px] lg:text-[11px] font-black uppercase tracking-widest ${capturedTheme.text} mt-0.5`}>Capturado · {stage.files.length} arquivos</p>
          ) : (
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-[#8aa5c4] lg:text-[11px]">Pendente de envio</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleOpenFaq}
          className={`hidden min-h-10 shrink-0 items-center gap-2 rounded-2xl px-4 text-xs font-black shadow-[0_8px_22px_rgba(22,78,129,0.1)] transition-colors sm:inline-flex ${capturedTheme.icon}`}
          aria-label={`Ver FAQ da etapa ${stage.title}`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8-3.5a1.5 1.5 0 0 0-1.493 1.356.75.75 0 1 1-1.493-.143A3 3 0 1 1 10.75 10.6v.15a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75A1.5 1.5 0 1 0 10 6.5Zm0 8.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          FAQ
        </button>

        <button
          type="button"
          onClick={handleOpenFaq}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[0_8px_22px_rgba(22,78,129,0.1)] sm:hidden ${capturedTheme.icon}`}
          aria-label={`Ver FAQ da etapa ${stage.title}`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8-3.5a1.5 1.5 0 0 0-1.493 1.356.75.75 0 1 1-1.493-.143A3 3 0 1 1 10.75 10.6v.15a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75A1.5 1.5 0 1 0 10 6.5Zm0 8.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
        </button>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#42668f] shadow-[0_8px_22px_rgba(22,78,129,0.1)] transition-transform duration-300 lg:h-11 lg:w-11 ${isExpanded ? 'rotate-180' : ''}`}>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      <div id={`stage-panel-${stage.id}`} className={`overflow-hidden transition-[max-height,opacity] duration-300 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-6 px-5 pb-6 sm:px-6 sm:pb-8 sm:space-y-8 lg:px-7 lg:pb-8">
          {isUsageLocked && (
            <div className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-3 text-left">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1.944a4.5 4.5 0 0 0-4.5 4.5V8H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V6.444a4.5 4.5 0 0 0-4.5-4.5Zm3 6.056V6.444a3 3 0 1 0-6 0V8h6Z" clipRule="evenodd" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-black text-[#082653]">Material usado pela edição</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6d8db1]">
                  Esta etapa foi marcada pelo editor e nao recebe novos uploads para preservar o material usado na producao.
                </p>
              </div>
            </div>
          )}
          {/* Upload Area */}
          {!isCaptured && !isUsageLocked ? (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group relative rounded-[1.5rem] border-2 border-dashed p-6 text-center transition-all sm:rounded-3xl sm:p-10 lg:rounded-[2rem] lg:p-12 ${
                isDragging ? `${capturedTheme.border} bg-white/70` : 'border-[#d7ebfb] bg-white/50 hover:border-[#7bcdfb] hover:bg-white/60'
              }`}
            >
              <div className="flex flex-col items-center gap-3 sm:gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ring-8 sm:h-16 sm:w-16 ${capturedTheme.icon} ring-white/60`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 sm:h-8 sm:w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight text-[#082653] sm:text-base">Arraste fotos, vídeos, áudios ou</p>
                  <p className="mt-1 text-xs font-bold text-[#7d9bbd]">Toque para buscar na galeria ou câmera</p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                  className={`mt-1 inline-flex items-center justify-center rounded-2xl px-6 py-2.5 text-xs font-black text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 sm:mt-2 sm:px-8 sm:py-3 sm:text-sm ${capturedTheme.uploadButton}`}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {uploadProgress?.percentage}% Enviando...
                    </span>
                  ) : (
                    'Selecionar arquivos'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`space-y-4 rounded-[1.5rem] border-2 border-dashed p-3 transition-all sm:p-4 ${
                isDragging && !isUsageLocked
                  ? `${capturedTheme.border} bg-white/65`
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#7d9bbd]">Arquivos enviados</h4>
                {!isUsageLocked && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className={`text-xs font-black transition-colors ${capturedTheme.buttonText}`}
                    >
                      + Adicionar mais
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                {stage.files.map(file => (
                  <div key={file.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/80 bg-[#eaf7ff] shadow-[0_10px_26px_rgba(22,78,129,0.1)] lg:rounded-[1.5rem]">
                    {isImageFile(file) ? (
                      <button type="button" onClick={() => setLightboxFile(file)} className="h-full w-full" aria-label={`Abrir imagem ${file.name}`}>
                        <DriveImage file={file} className="h-full w-full object-cover" preferThumbnail thumbnailOnly />
                      </button>
                    ) : isVideoFile(file) ? (
                      <VideoTile file={file} onClick={() => setLightboxFile(file)} />
                    ) : isAudioFile(file) ? (
                      <button type="button" onClick={() => setLightboxFile(file)} className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-950 p-4 text-center text-white" aria-label={`Abrir audio ${file.name}`}>
                        <AudioIcon className="h-8 w-8" />
                      </button>
                    ) : (
                      <button type="button" onClick={() => setLightboxFile(file)} className="h-full w-full" aria-label={`Abrir arquivo ${file.name}`}>
                        <MediaFallback file={file} label="Arquivo" />
                      </button>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#082653]/85 via-[#082653]/45 to-transparent px-2.5 pb-2.5 pt-8">
                      <p className="truncate text-[10px] font-black text-white drop-shadow-sm" title={file.name}>{file.name}</p>
                    </div>
                    {!isUsageLocked && (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); handleDeleteFile(file); }}
                        disabled={deletingFileId === file.id}
                        aria-label={`Remover arquivo ${file.name}`}
                        className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-50 sm:h-9 sm:w-9 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3" role="status" aria-live="polite">
            <WarningIcon className="h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

      {/* FAQ Popup */}
      {faqOpen && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setFaqOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`FAQ da etapa ${stage.title}`}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-widest ${capturedTheme.text}`}>FAQ da etapa</p>
                <h2 className="mt-1 truncate text-base font-black text-zinc-950 sm:text-lg">{stage.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setFaqOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200"
                aria-label="Fechar FAQ"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-5 sm:px-6">
              {faqLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
                </div>
              ) : faqs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                  <p className="text-sm font-bold text-zinc-500">Nenhum FAQ cadastrado para esta etapa.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {faqs.map(faq => (
                    <article key={faq.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                      <div className="p-5">
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                          {faq.stage_type}
                        </span>
                        <h3 className="mt-2 text-base font-black text-zinc-950">{faq.title}</h3>
                        {faq.content ? (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">{faq.content}</p>
                        ) : (
                          <p className="mt-3 text-sm font-semibold text-zinc-400">Sem conteúdo textual cadastrado.</p>
                        )}
                      </div>
                      {faq.image_url && (
                        <div className="border-t border-zinc-100 bg-zinc-50 p-3">
                          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                            {isExampleVideo(faq.image_url) ? (
                              <video src={faq.image_url} controls className="max-h-[420px] w-full bg-black object-contain" />
                            ) : (
                              <img src={faq.image_url} alt={faq.title} width={960} height={540} loading="lazy" decoding="async" className="max-h-[420px] w-full object-contain" />
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox */}
      {lightboxFile && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxFile(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Pre-visualizacao de ${lightboxFile.name}`}
        >
          <div
            className="relative max-h-full max-w-4xl w-full overflow-hidden rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setLightboxFile(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-colors"
              aria-label="Fechar pre-visualizacao"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
            {/* Content */}
            <div className="flex max-h-[85vh] items-center justify-center bg-zinc-900">
              {isImageFile(lightboxFile) ? (
                <DriveImage
                  file={lightboxFile}
                  className="max-h-[85vh] max-w-full object-contain"
                />
              ) : isVideoFile(lightboxFile) ? (
                <VideoPlayer
                  file={lightboxFile}
                  controls
                  autoPlay
                  className="max-h-[85vh] max-w-full"
                />
              ) : isAudioFile(lightboxFile) ? (
                <div className="flex flex-col items-center justify-center gap-6 p-12 text-white">
                  <AudioIcon className="h-16 w-16" />
                  <audio src={lightboxFile.public_url} controls autoPlay preload="metadata" className="w-full max-w-sm" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 p-12 text-white">
                  <AttachmentIcon className="h-14 w-14" />
                </div>
              )}
            </div>
            {canNavigateLightbox && (
              <>
                <button
                  type="button"
                  onClick={() => goToLightboxFile(-1)}
                  className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
                  aria-label="Arquivo anterior"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L9.06 10l3.71 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.08.02Z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => goToLightboxFile(1)}
                  className="absolute right-14 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
                  aria-label="Proximo arquivo"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.08-.02Z" clipRule="evenodd" />
                  </svg>
                </button>
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10">
              <p className="truncate text-xs font-black text-white">{lightboxFile.name}</p>
              {canNavigateLightbox && (
                <p className="mt-0.5 text-[10px] font-bold text-white/60">{lightboxIndex + 1} de {stage.files.length}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CaseStageCard;
