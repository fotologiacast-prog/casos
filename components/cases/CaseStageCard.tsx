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
  const [isExpanded, setIsExpanded] = useState(false);

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

  const handleToggleExpand = async () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (nextState && faqs.length === 0) {
      await loadFaqs();
    }
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
      id={`stage-${stage.id}`}
      className={`relative rounded-[2rem] transition-all duration-300 overflow-hidden ${
        isCaptured
          ? 'bg-white shadow-[0_12px_36px_rgba(16,185,129,0.12)]'
          : 'bg-white shadow-sm'
      } ${isExpanded ? 'ring-2 ring-emerald-500/10' : 'border border-zinc-100 hover:border-zinc-200'}`}
    >
      <div 
        className="cursor-pointer px-6 py-5 flex items-center gap-4 transition-colors hover:bg-zinc-50/50"
        onClick={handleToggleExpand}
      >
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg transition-all ${
          isCaptured ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'
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
          <h3 className="text-base font-black text-zinc-900 truncate tracking-tight">{stage.title}</h3>
          {isCaptured ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-0.5">Capturado · {stage.files.length} arquivos</p>
          ) : (
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-0.5">Pendente de envio</p>
          )}
        </div>

        <div className={`h-8 w-8 flex items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-6 pb-8 space-y-8">
          {/* Upload Area */}
          {!isCaptured ? (
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`group relative rounded-3xl border-2 border-dashed p-10 text-center transition-all ${
                isDragging ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-black text-zinc-900 tracking-tight">Arraste fotos, vídeos, áudios ou</p>
                  <p className="mt-1 text-xs font-bold text-zinc-400">Toque para buscar na galeria ou câmera</p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                  className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[#34C759] px-8 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
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
              <input ref={inputRef} type="file" multiple accept={UPLOAD_ACCEPT} onChange={handleInputChange} className="hidden" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Arquivos enviados</h4>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  + Adicionar mais
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {stage.files.map(file => (
                  <div key={file.id} className="group relative aspect-square rounded-2xl bg-zinc-100 overflow-hidden border border-zinc-100">
                    {isImageFile(file) ? (
                      <img src={file.public_url} className="h-full w-full object-cover" onClick={() => setLightboxFile(file)} />
                    ) : (
                      <VideoPlayer src={file.public_url} className="h-full w-full object-cover" onClick={() => setLightboxFile(file)} />
                    )}
                    <button
                      onClick={() => handleDeleteFile(file)}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <input ref={inputRef} type="file" multiple accept={UPLOAD_ACCEPT} onChange={handleInputChange} className="hidden" />
            </div>
          )}

          {/* FAQ / Requirements Section */}
          <div className="space-y-8 pt-4 border-t border-zinc-100">
            {/* Requisitos */}
            <div className="space-y-4">
              <h4 className="text-sm font-black text-[#34C759] tracking-tight">Requisitos</h4>
              <div className="space-y-3">
                {(faqs.length > 0 ? faqs.filter(f => !f.image_url) : [{ title: 'Mínimo de 4 fotos', id: '1' }, { title: 'Boa iluminação', id: '2' }, { title: 'Foco nítido e enquadramento adequado', id: '3' }]).map(req => (
                  <div key={req.id} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-zinc-500 leading-tight">{req.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Exemplos */}
            <div className="space-y-4">
              <h4 className="text-sm font-black text-[#34C759] tracking-tight">Exemplos</h4>
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                {faqs.filter(f => f.image_url).length > 0 ? (
                  faqs.filter(f => f.image_url).map(example => (
                    <div key={example.id} className="h-28 w-28 shrink-0 rounded-2xl bg-zinc-100 overflow-hidden border border-zinc-200">
                      {isExampleVideo(example.image_url!) ? (
                        <video src={example.image_url!} className="h-full w-full object-cover" />
                      ) : (
                        <img src={example.image_url!} className="h-full w-full object-cover" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] font-bold text-zinc-400 italic">Nenhum exemplo cadastrado.</div>
                )}
              </div>
              {/* Pagination Dots (Visual only) */}
              <div className="flex justify-center gap-1.5 pt-2">
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-200" />
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-200" />
              </div>
            </div>
          </div>
        </div>
      </div>

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
