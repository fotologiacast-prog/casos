import { CaseStage } from '../types';
import {
  chooseChunkSize,
  getChunkRange,
  parseDriveUploadedBytes,
} from './resumableUploadUtils.js';

type DriveUploadStartResponse = {
  uploadUrl: string;
  folderId: string;
};

type DriveUploadCompleteResponse = {
  file: {
    id: string;
    drive_file_id: string;
    file_name: string;
    mime_type: string | null;
    web_view_link: string | null;
    web_content_link: string | null;
  };
};

const requestDriveUploadStart = async (stageId: string, file: File): Promise<DriveUploadStartResponse> => {
  const response = await fetch('/api/drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'start',
      stageId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.details || data.error || 'Falha ao preparar upload no Drive.');
  return data;
};

const requestDriveUploadComplete = async (stageId: string, driveFileId: string): Promise<DriveUploadCompleteResponse> => {
  const response = await fetch('/api/drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      stageId,
      driveFileId,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.details || data.error || 'Falha ao salvar arquivo no banco.');
  return data;
};

export interface UploadProgressInfo {
  percentage: number;
  loaded: number;
  total: number;
  fileName?: string;
  fileIndex?: number;
  fileCount?: number;
  phase?: 'preparing' | 'uploading' | 'reconnecting' | 'resuming' | 'saving';
  attempt?: number;
}

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const waitUntilOnline = async () => {
  if (navigator.onLine) return;
  await new Promise<void>(resolve => {
    const handleOnline = () => {
      window.removeEventListener('online', handleOnline);
      resolve();
    };
    window.addEventListener('online', handleOnline);
  });
};

const emitProgress = (
  file: File,
  loaded: number,
  extras: Partial<UploadProgressInfo>,
  onProgress?: (info: UploadProgressInfo) => void
) => {
  if (!onProgress) return;
  onProgress({
    percentage: file.size > 0 ? Math.min(100, Math.round((loaded / file.size) * 100)) : 0,
    loaded,
    total: file.size,
    fileName: file.name,
    ...extras,
  });
};

const sendDriveStatusProbe = async (uploadUrl: string, file: File) =>
  new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Range', `bytes */${file.size}`);

    xhr.onload = () => {
      if (xhr.status === 308) return resolve(parseDriveUploadedBytes(xhr.getResponseHeader('Range')));
      if (xhr.status >= 200 && xhr.status < 300) return resolve(file.size);

      let message = `Falha ao consultar progresso de "${file.name}" no Drive.`;
      try {
        const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        message = data.error?.message || data.error || message;
      } catch {
        if (xhr.responseText) message = xhr.responseText;
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error(`Erro de rede ao consultar progresso de "${file.name}".`));
    xhr.send();
  });

const uploadDriveChunk = async (
  uploadUrl: string,
  file: File,
  start: number,
  end: number,
  onProgress?: (info: UploadProgressInfo) => void,
  extras: Partial<UploadProgressInfo> = {}
) =>
  new Promise<{ done: boolean; fileId?: string; uploadedBytes: number }>((resolve, reject) => {
    const chunk = file.slice(start, end + 1);
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    const isFullFile = start === 0 && end === file.size - 1;
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    if (!isFullFile) {
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${file.size}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        emitProgress(file, start + event.loaded, { ...extras, phase: 'uploading' }, onProgress);
      }
    };

    xhr.onload = () => {
      let data: any = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = xhr.responseText ? { error: xhr.responseText } : {};
      }

      if (xhr.status === 308) {
        return resolve({
          done: false,
          uploadedBytes: parseDriveUploadedBytes(xhr.getResponseHeader('Range')) || end + 1,
        });
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (!data.id) return reject(new Error('O Google Drive nao retornou o ID do arquivo enviado.'));
        return resolve({ done: true, fileId: data.id, uploadedBytes: file.size });
      }

      reject(new Error(data.error?.message || data.error || `Falha ao enviar "${file.name}" para o Drive.`));
    };

    xhr.onerror = () => reject(new Error(`Erro de rede ao enviar "${file.name}" para o Drive.`));
    xhr.send(chunk);
  });

export const putFileDirectlyToDrive = async (
  uploadUrl: string,
  file: File,
  onProgress?: (info: UploadProgressInfo) => void,
  extras: Partial<UploadProgressInfo> = {}
) => {
  if (file.size <= 0) throw new Error(`O arquivo "${file.name}" esta vazio.`);

  const chunkSize = chooseChunkSize(file.size);
  let offset = 0;
  let failures = 0;

  emitProgress(file, 0, { ...extras, phase: 'uploading' }, onProgress);

  while (offset < file.size) {
    await waitUntilOnline();

    const { start, end } = getChunkRange(offset, file.size, chunkSize);
    try {
      const result = await uploadDriveChunk(uploadUrl, file, start, end, onProgress, {
        ...extras,
        attempt: failures + 1,
      });
      offset = Math.min(file.size, result.uploadedBytes);
      failures = 0;
      emitProgress(file, offset, { ...extras, phase: result.done ? 'saving' : 'uploading' }, onProgress);
      if (result.done && result.fileId) return { id: result.fileId };
    } catch (error) {
      failures += 1;
      emitProgress(file, offset, { ...extras, phase: 'reconnecting', attempt: failures }, onProgress);

      if (failures > 8) {
        throw error;
      }

      await waitUntilOnline();
      await sleep(Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)));

      try {
        emitProgress(file, offset, { ...extras, phase: 'resuming', attempt: failures }, onProgress);
        offset = Math.min(file.size, await sendDriveStatusProbe(uploadUrl, file));
      } catch {
        // Keep the last local offset and try the same chunk again.
      }
    }
  }

  throw new Error(`Upload de "${file.name}" nao foi finalizado pelo Drive.`);
};

export const uploadStageFilesToDrive = async (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => {
  for (const [index, file] of files.entries()) {
    onProgress?.({
      percentage: 0,
      loaded: 0,
      total: file.size,
      fileName: file.name,
      fileIndex: index + 1,
      fileCount: files.length,
      phase: 'preparing',
    });
    const { uploadUrl } = await requestDriveUploadStart(stage.id, file);
    const uploadedFile = await putFileDirectlyToDrive(uploadUrl, file, onProgress, {
      fileIndex: index + 1,
      fileCount: files.length,
    });
    await requestDriveUploadComplete(stage.id, uploadedFile.id);
  }
};

export const uploadFaqExampleMediaToDrive = async (
  stageType: string,
  file: File,
  adminPassword: string,
  onProgress?: (info: UploadProgressInfo) => void
) => {
  onProgress?.({
    percentage: 0,
    loaded: 0,
    total: file.size,
    fileName: file.name,
    fileIndex: 1,
    fileCount: 1,
    phase: 'preparing',
  });

  const startResponse = await fetch('/api/faq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
    body: JSON.stringify({
      action: 'media_start',
      stage_type: stageType,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  const startData = await startResponse.json().catch(() => ({}));
  if (!startResponse.ok) throw new Error(startData.details || startData.error || 'Falha ao preparar exemplo no Drive.');

  const uploadedFile = await putFileDirectlyToDrive(startData.uploadUrl, file, onProgress, {
    fileIndex: 1,
    fileCount: 1,
  });

  const completeResponse = await fetch('/api/faq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
    body: JSON.stringify({ action: 'media_complete', driveFileId: uploadedFile.id }),
  });
  const completeData = await completeResponse.json().catch(() => ({}));
  if (!completeResponse.ok) throw new Error(completeData.details || completeData.error || 'Falha ao salvar exemplo do FAQ.');
  return completeData as { mediaUrl: string; file?: { id: string; name: string; mimeType?: string } };
};
