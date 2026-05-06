import React, { useRef, useState } from 'react';
import { CaseStage } from '../../types';

interface CaseStageCardProps {
  index: number;
  stage: CaseStage;
  onUpload: (stage: CaseStage, files: File[]) => Promise<void>;
}

const isImageFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|tiff?|svg)$/i.test(file.name);
};

const isVideoFile = (file: CaseStage['files'][number]) => {
  if (file.type?.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
};

const CaseStageCard: React.FC<CaseStageCardProps> = ({ index, stage, onUpload }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCaptured = stage.status === 'Capturado' || stage.files.length > 0;

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    setError(null);
    setIsUploading(true);
    try {
      await onUpload(stage, files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar arquivos.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`rounded-lg p-5 shadow-sm transition-all ${
        isCaptured
          ? 'border-2 border-emerald-300 bg-emerald-50/60 shadow-emerald-100'
          : 'border border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                isCaptured
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isCaptured ? '✓' : index + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-950">{stage.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {stage.files.length > 0
                  ? `${stage.files.length} arquivo${stage.files.length === 1 ? '' : 's'} enviado${stage.files.length === 1 ? '' : 's'}`
                  : 'Nenhum arquivo enviado'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
              isCaptured
                ? 'bg-emerald-600 text-white ring-emerald-600'
                : 'bg-slate-100 text-slate-600 ring-slate-200'
            }`}
          >
            {isCaptured ? 'Capturado' : 'Fazer'}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFiles}
        className="hidden"
      />

      {stage.files.length > 0 && (
        <div className="mt-5 border-t border-emerald-200/80 pt-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Arquivos capturados</p>
              <p className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{stage.files.length}</p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="w-fit rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {isUploading ? 'Enviando...' : 'Fazer upload de novas imagens'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stage.files.map(file => (
            <a
              key={file.id}
              href={file.public_url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:border-sky-300 hover:shadow-sm transition-all"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
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
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                      {isVideoFile(file) ? '▶' : '📎'}
                    </span>
                    <span className="px-2 text-center text-xs font-semibold">
                      {isVideoFile(file) ? 'Video' : 'Arquivo'}
                    </span>
                  </div>
                )}
                {isVideoFile(file) && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Video
                  </span>
                )}
              </div>
              <div className="border-t border-slate-200 px-3 py-2">
                <p className="truncate text-xs font-semibold text-slate-700">{file.name}</p>
              </div>
            </a>
          ))}
          </div>
        </div>
      )}

      {!isCaptured && (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">Aguardando envio de arquivos para esta etapa.</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {isUploading ? 'Enviando...' : 'Fazer upload'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
};

export default CaseStageCard;
