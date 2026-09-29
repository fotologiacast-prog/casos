import { DRIVE_ROOT_FOLDER_ID, DRIVE_SERVICE_ACCOUNT_EMAIL } from '../config';
import { CasePatient, CaseStage } from '../types';

export interface DriveUploadTarget {
  rootFolderId: string;
  clientFolderId?: string;
  serviceAccountEmail: string;
  patientFolderName: string;
  stageFolderName: string;
}

const sanitizeDriveName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

const formatFolderDate = (date: Date | null) =>
  (date || new Date()).toISOString().slice(0, 10);

export const buildDriveUploadTarget = (
  clientFolderId: string | undefined,
  patient: CasePatient,
  stage: CaseStage
): DriveUploadTarget => {
  const stageNumber = patient.stages.findIndex(item => item.id === stage.id) + 1;
  const paddedStageNumber = String(stageNumber > 0 ? stageNumber : 1).padStart(2, '0');

  return {
    rootFolderId: DRIVE_ROOT_FOLDER_ID,
    clientFolderId,
    serviceAccountEmail: DRIVE_SERVICE_ACCOUNT_EMAIL,
    patientFolderName: sanitizeDriveName(`${patient.name} - ${formatFolderDate(patient.createdAt)}`),
    stageFolderName: sanitizeDriveName(`${paddedStageNumber} ${stage.title}`),
  };
};

export const getDriveSetupWarning = (clientFolderId?: string) => {
  if (!DRIVE_ROOT_FOLDER_ID) return 'Pasta raiz do Google Drive nao configurada.';
  if (!DRIVE_SERVICE_ACCOUNT_EMAIL) return 'Service account do Google Drive nao configurada.';
  if (!clientFolderId) return 'Pasta do cliente no Google Drive ainda nao cadastrada.';
  return null;
};
