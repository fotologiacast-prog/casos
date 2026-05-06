import React, { useRef, useState } from 'react';
import { CaseStage, CaseStageMoment } from '../../types';
import { UploadProgressInfo } from '../../services/driveUploadService';

interface CaseStageCardProps {
  index: number;
  stage: CaseStage;
  onUpload: (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => Promise<void>;
  isPlaceholder?: boolean;
}

const isImageFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|tiff?|svg)$/i.test(file.name);
};

const isVideoFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
};

const momentAccent: Record<CaseStageMoment, string> = {
  Planejamento: 'bg-zinc-900',
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

const CaseStageCard: React.FC<CaseStageCardProps> = ({ index, stage, onUpload, isPlaceholder }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCaptured = stage.status === 'Capturado' || stage.files.length > 0;
  const moment = (stage.moment || stage.title) as CaseStageMoment;
  const accentClass = momentAccent[moment] || momentAccent.Planejamento;

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
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await handleFiles(files);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (isPlaceholder) return;
    const files = Array.from(event.dataTransfer.files);
    await handleFiles(files);
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isCaptured
          ? 'border-black/20 bg-white shadow-sm'
          : 'border-zinc-200 bg-white'
      }`}
    >
      {/* Moment accent strip */}
      <div className={`h-1 w-full ${isCaptured ? 'bg-black' : accentClass} opacity-60`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              isCaptured ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600'
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
                <span className="rounded-full bg-black px-2.5 py-0.5 text-[11px] font-bold text-white">
                  Capturado
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
                    {isUploading ? `Enviando... ${uploadProgress !== null ? `${uploadProgress.percentage}%` : ''}` : '+ Adicionar'}
                  </span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stage.files.map(file => (
                <a
                  key={file.id}
                  href={file.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 hover:border-zinc-400 hover:shadow-md transition-all duration-200"
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
                      <video src={file.public_url} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm text-xl">
                          {isVideoFile(file) ? '▶' : '📎'}
                        </span>
                      </div>
                    )}
                    {isVideoFile(file) && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                        Vídeo
                      </span>
                    )}
                  </div>
                  <div className="border-t border-zinc-200 px-3 py-2">
                    <p className="truncate text-xs font-semibold text-zinc-700">{file.name}</p>
                  </div>
                </a>
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
              accept="image/*,video/*"
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
                      {isDragging ? 'Solte os arquivos aqui' : 'Arraste fotos/vídeos ou'}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">Imagens e vídeos aceitos</p>
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
                          Enviando... {uploadProgress !== null ? `${uploadProgress.percentage}%` : ''}
                        </span>
                        {uploadProgress !== null && (
                          <span className="text-[10px] font-medium text-white/70">
                            {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
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
              accept="image/*,video/*"
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
    </div>
  );
};

export default CaseStageCard;
