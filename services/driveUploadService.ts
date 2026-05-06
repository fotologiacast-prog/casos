import { CaseStage } from '../types';

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
  const response = await fetch('/api/drive-upload', {
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
  const response = await fetch('/api/drive-upload', {
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
}

const putFileDirectlyToDrive = async (uploadUrl: string, file: File, onProgress?: (info: UploadProgressInfo) => void) => {
  if (file.size <= 0) throw new Error(`O arquivo "${file.name}" esta vazio.`);

  return new Promise<{ id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress({ percentage, loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      let data: any = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = xhr.responseText ? { error: xhr.responseText } : {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (!data.id) return reject(new Error('O Google Drive nao retornou o ID do arquivo enviado.'));
        resolve(data as { id: string });
      } else {
        reject(new Error(data.error?.message || data.error || `Falha ao enviar "${file.name}" para o Drive.`));
      }
    };

    xhr.onerror = () => reject(new Error(`Erro de rede ao enviar "${file.name}" para o Drive.`));
    xhr.send(file);
  });
};

export const uploadStageFilesToDrive = async (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => {
  for (const file of files) {
    const { uploadUrl } = await requestDriveUploadStart(stage.id, file);
    const uploadedFile = await putFileDirectlyToDrive(uploadUrl, file, onProgress);
    await requestDriveUploadComplete(stage.id, uploadedFile.id);
  }
};
