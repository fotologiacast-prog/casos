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
  if (!response.ok) throw new Error(data.error || data.details || 'Falha ao preparar upload no Drive.');
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
  if (!response.ok) throw new Error(data.error || data.details || 'Falha ao salvar arquivo no banco.');
  return data;
};

const putFileDirectlyToDrive = async (uploadUrl: string, file: File) => {
  if (file.size <= 0) throw new Error(`O arquivo "${file.name}" esta vazio.`);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Range': `bytes 0-${file.size - 1}/${file.size}`,
    },
    body: file,
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text ? { error: text } : {};
  }

  if (!response.ok) {
    throw new Error(data.error?.message || data.error || `Falha ao enviar "${file.name}" para o Drive.`);
  }

  if (!data.id) throw new Error('O Google Drive nao retornou o ID do arquivo enviado.');
  return data as { id: string };
};

export const uploadStageFilesToDrive = async (stage: CaseStage, files: File[]) => {
  for (const file of files) {
    const { uploadUrl } = await requestDriveUploadStart(stage.id, file);
    const uploadedFile = await putFileDirectlyToDrive(uploadUrl, file);
    await requestDriveUploadComplete(stage.id, uploadedFile.id);
  }
};
