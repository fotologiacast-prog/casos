import React, { useEffect, useRef, useState } from 'react';
import { CaseStage, CaseStageMoment } from '../../types';
import { UploadProgressInfo } from '../../services/driveUploadService';
import { getCaseStageFaqTypes } from '../../utils/caseConstants';

interface StageFaq {
  id: string;
  stage_type: string;
  title: string;
  content: string;
  image_url?: string | null;
  order: number;
}

interface CaseStageCardProps {
  index: number;
  stage: CaseStage;
  onUpload: (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => Promise<void>;
  onFileDeleted?: (stageId: string, fileId: string) => void;
  isPlaceholder?: boolean;
}

const isImageFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|jfif|gif|webp|bmp|tiff?|svg|heic|heif|avif|raw|dng|cr2|nef|arw)$/i.test(file.name);
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
  '.nef',
  '.arw',
].join(',');

const momentAccent: Record<CaseStageMoment, string> = {
  Planejamento: 'bg-emerald-400',
  Procedimento: 'bg-zinc-700',
  Entrega: 'bg-zinc-500',
  Evento: 'bg-zinc-300',
};

const momentLabel: Record<CaseStageMoment, string> = {
  Planejamento: 'Planejamento',
  Procedimento: 'Procedimento',
  Entrega: 'Entrega',
  Evento: 'Evento',
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

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

const VideoPlayer = ({ src, className, controls, autoPlay, muted }: any) => {
  const [hasError, setHasError] = useState(false);
  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-zinc-900 p-4 text-center text-white ${className}`}>
        <span className="mb-2 text-xl">⏳</span>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-tight">Processando no Drive</p>
        <p className="mt-1 text-[9px] text-zinc-500 leading-tight">Aguarde a finalização do processamento.</p>
      </div>
    );
  }
  return (
    <video
      src={src}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
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
  const [faqs, setFaqs] = useState<StageFaq[]>([]);
  const [faqOpen, setFaqOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [faqLoading, setFaqLoading] = useState(false);

  useEffect(() => {
    if (!isUploading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  const stageType = stage.title;

  const loadFaqs = async () => {
    if (faqs.length > 0) return;
    setFaqLoading(true);
    try {
      const stageTypes = getCaseStageFaqTypes(stageType).join('|');
      const res = await fetch(`/api/faq?stage_type=${encodeURIComponent(stageTypes)}`);
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs || []);
      }
    } catch {/* silent */} finally {
      setFaqLoading(false);
    }
  };

  const handleOpenFaq = async () => {
    setFaqOpen(true);
    await loadFaqs();
  };

  const handleOpenExamples = async () => {
    setExampleOpen(true);
    await loadFaqs();
  };

  const isCaptured = stage.status === 'Capturado' || stage.files.length > 0;
  const moment = (stage.moment || stage.title) as CaseStageMoment;
  const accentClass = momentAccent[moment] || momentAccent.Planejamento;
  const exampleFaqs = faqs.filter(faq => faq.image_url);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0 || isPlaceholder) return;
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

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (isPlaceholder) return;
    const files = Array.from(event.dataTransfer.files) as File[];
    await handleFiles(files);
  };

  const handleDeleteFile = async (file: CaseStage['files'][number]) => {
    if (!window.confirm(`Remover "${file.name}" permanentemente do Drive e do sistema?`)) return;
    setDeletingFileId(file.id);
    try {
      const response = await fetch('/api/drive-delete', {
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
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isCaptured
          ? 'border-emerald-400 bg-emerald-50/20 shadow-sm ring-2 ring-emerald-100'
          : 'border-zinc-200 bg-white'
      }`}
    >
      {/* Moment accent strip */}
      <div className={`h-1.5 w-full ${isCaptured ? 'bg-emerald-500' : accentClass} opacity-80`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              isCaptured ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {isCaptured ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z" clipRule="evenodd" />
              </svg>
            ) : (
              index + 1
            )}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900">{stage.title}</h3>
              {isPlaceholder && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-500">
                  Pendente sincronização
                </span>
              )}
              {isCaptured && !isPlaceholder && (
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  Capturado
                </span>
              )}
              {!isCaptured && !isPlaceholder && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                  Falta enviar
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isPlaceholder
                ? 'Esta etapa será habilitada automaticamente'
                : stage.files.length > 0
                ? `${stage.files.length} arquivo${stage.files.length === 1 ? '' : 's'} enviado${stage.files.length === 1 ? '' : 's'}`
                : 'Nenhum arquivo enviado ainda'}
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleOpenFaq}
              title="Ver FAQ"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleOpenExamples}
              title="Ver exemplos visuais"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 7.81 3.22-3.22a1.75 1.75 0 0 1 2.47 0l1.06 1.06 2.56-2.56a1.75 1.75 0 0 1 2.47 0l3.22 3.22V5.25a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v7.81ZM17.5 14.75v-1.07l-4.28-4.28a.25.25 0 0 0-.35 0l-2.56 2.56 1.22 1.22a.75.75 0 1 1-1.06 1.06l-3.34-3.34a.25.25 0 0 0-.35 0L2.5 15.18a.75.75 0 0 0 .75.32h13.5a.75.75 0 0 0 .75-.75ZM6.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expected items checklist */}
        {!!stage.expectedItems?.length && (
          <div className="mt-4 rounded-xl bg-zinc-50 p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Itens esperados
            </p>
            <div className="space-y-2">
              {stage.expectedItems.map(item => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${isCaptured ? 'bg-black text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                    {isCaptured ? '✓' : item.match(/^(\d+)/)?.[1] || '·'}
                  </span>
                  <span className="text-sm leading-5 text-zinc-700">{item.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded files */}
        {stage.files.length > 0 && (
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Arquivos capturados <span className="ml-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-white text-[10px]">{stage.files.length}</span>
              </p>
              {!isPlaceholder && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                  className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                >
                  {isUploading && uploadProgress !== null && (
                    <div className="absolute inset-0 bg-zinc-100 transition-all duration-300" style={{ width: `${uploadProgress.percentage}%` }} />
                  )}
                  <span className="relative z-10">
                    {isUploading ? getUploadLabel(uploadProgress) : '+ Adicionar'}
                  </span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stage.files.map(file => (
                <div
                  key={file.id}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 hover:border-zinc-400 hover:shadow-md transition-all duration-200"
                >
                  {/* Clickable thumbnail */}
                  <button
                    type="button"
                    onClick={() => setLightboxFile(file)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[4/3] bg-zinc-100">
                      {isImageFile(file) && file.public_url !== '#' ? (
                        <img
                          src={file.public_url}
                          alt={file.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : isVideoFile(file) && file.public_url !== '#' ? (
                        <VideoPlayer src={file.public_url} className="h-full w-full object-cover" muted />
                      ) : isAudioFile(file) ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm text-xl">♪</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest">Áudio</span>
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm text-xl">📎</span>
                        </div>
                      )}
                      {isVideoFile(file) && (
                        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">Vídeo</span>
                      )}
                      {isAudioFile(file) && (
                        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">Áudio</span>
                      )}
                      {/* Expand hint */}
                      <span className="absolute right-2 top-2 hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M3.5 3A.5.5 0 0 0 3 3.5v4a.5.5 0 0 0 1 0V4.707l3.646 3.647a.5.5 0 0 0 .708-.708L4.707 4H7.5a.5.5 0 0 0 0-1h-4ZM16.5 3a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.707l-3.646 3.647a.5.5 0 0 1-.708-.708L15.293 4H12.5a.5.5 0 0 1 0-1h4ZM3 12.5a.5.5 0 0 1 1 0v2.793l3.646-3.647a.5.5 0 0 1 .708.708L4.707 16H7.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5v-4ZM17 12.5a.5.5 0 0 0-1 0v2.793l-3.646-3.647a.5.5 0 0 0-.708.708L15.293 16H12.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 .5-.5v-4Z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </div>
                  </button>
                  {/* Remove button */}
                  {!isPlaceholder && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(file)}
                      disabled={deletingFileId === file.id}
                      className="w-full border-t border-red-50 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
                    >
                      {deletingFileId === file.id ? 'Removendo...' : '✕ Remover'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload zone */}
        {!isCaptured && (
          <div className="mt-4">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              onChange={handleInputChange}
              className="hidden"
              disabled={isPlaceholder}
            />

            {isPlaceholder ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-5 text-center">
                <p className="text-sm font-medium text-zinc-400">Upload será habilitado automaticamente</p>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all duration-200 ${
                  isDragging
                    ? 'border-black bg-zinc-50 scale-[1.01]'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-zinc-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-700">
                      {isDragging ? 'Solte os arquivos aqui' : 'Arraste fotos, vídeos, áudios ou'}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">Imagens, vídeos e áudios em formatos variados</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isUploading}
                    className="relative overflow-hidden rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors active:scale-95"
                  >
                    {isUploading && uploadProgress !== null && (
                      <div className="absolute inset-0 bg-white/20 transition-all duration-300" style={{ width: `${uploadProgress.percentage}%` }} />
                    )}
                    {isUploading ? (
                      <span className="relative z-10 flex flex-col items-center gap-0.5">
                        <span className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          {getUploadLabel(uploadProgress)}
                        </span>
                        {getUploadDetail(uploadProgress) && (
                          <span className="text-[10px] font-medium text-white/70">
                            {getUploadDetail(uploadProgress)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="relative z-10">Selecionar arquivos</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add more files when already captured */}
        {isCaptured && stage.files.length > 0 && !isPlaceholder && (
          <div className="mt-3">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3">
            <span className="text-red-500">⚠</span>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* FAQ Popup */}
      {faqOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setFaqOpen(false)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Guia da etapa</p>
                <h2 className="mt-0.5 text-base font-black text-zinc-900">{stage.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setFaqOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">
              {faqLoading ? (
                <div className="flex items-center justify-center py-10">
                  <span className="h-6 w-6 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
                </div>
              ) : faqs.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="text-4xl">📋</span>
                  <p className="mt-3 text-sm font-semibold text-zinc-500">Nenhuma instrução cadastrada ainda.</p>
                  <p className="mt-1 text-xs text-zinc-400">O administrador pode adicionar exemplos no painel /admin.</p>
                </div>
              ) : (
                faqs.map((faq, i) => (
                  <div key={faq.id} className={i > 0 ? 'border-t border-zinc-100 pt-6' : ''}>
                    <h3 className="text-sm font-bold text-zinc-900">{faq.title}</h3>
                    {faq.content && (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">{faq.content}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Examples Popup */}
      {exampleOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setExampleOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Exemplos visuais</p>
                <h2 className="mt-0.5 text-base font-black text-zinc-900">{stage.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setExampleOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-5">
              {faqLoading ? (
                <div className="flex items-center justify-center py-10">
                  <span className="h-6 w-6 rounded-full border-2 border-zinc-300 border-t-emerald-600 animate-spin" />
                </div>
              ) : exampleFaqs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center">
                  <p className="text-sm font-semibold text-zinc-500">Nenhum exemplo visual cadastrado.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {exampleFaqs.map(faq => (
                    <div key={faq.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                      {isExampleVideo(faq.image_url || '') ? (
                        <video src={faq.image_url || ''} controls className="h-full max-h-[420px] w-full bg-black object-contain" />
                      ) : (
                        <img src={faq.image_url || ''} alt={faq.title} className="max-h-[420px] w-full object-contain" loading="lazy" />
                      )}
                      <div className="border-t border-zinc-200 bg-white px-4 py-3">
                        <p className="text-sm font-bold text-zinc-900">{faq.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxFile(null)}
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
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
            {/* Filename */}
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-8">
              <p className="truncate text-sm font-semibold text-white">{lightboxFile.name}</p>
              <a
                href={lightboxFile.public_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white transition-colors"
              >
                Abrir original ↗
              </a>
            </div>
            {/* Content */}
            <div className="flex max-h-[85vh] items-center justify-center bg-zinc-900">
              {isImageFile(lightboxFile) ? (
                <img
                  src={lightboxFile.public_url}
                  alt={lightboxFile.name}
                  className="max-h-[85vh] max-w-full object-contain"
                />
              ) : isVideoFile(lightboxFile) ? (
                <VideoPlayer
                  src={lightboxFile.public_url}
                  controls
                  autoPlay
                  className="max-h-[85vh] max-w-full"
                />
              ) : isAudioFile(lightboxFile) ? (
                <div className="flex flex-col items-center justify-center gap-6 p-12 text-white">
                  <span className="text-6xl">♪</span>
                  <p className="text-center text-sm font-semibold">{lightboxFile.name}</p>
                  <audio src={lightboxFile.public_url} controls autoPlay className="w-full max-w-sm" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 p-12 text-white">
                  <span className="text-5xl">📎</span>
                  <p className="text-center text-sm">{lightboxFile.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseStageCard;
