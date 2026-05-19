export interface ColumnValue {
  id: string;
  text: string;
  value: string;
  column: { title: string };
}

export interface Item {
  id: string;
  name: string;
  group?: { id: string; title: string };
  column_values: ColumnValue[];
  subitems?: Item[];
  assets: { id: string; name: string; public_url: string }[];
  board?: { id: string };
  updates?: any[];
}

export interface Board {
  id: string;
  name: string;
  columns: { id: string; title: string; type: string }[];
  items?: Item[];
}

export interface MondayApiResponse {
  data: {
    boards: Board[];
  };
}

export interface Client {
  id: number;
  name: string;
  boardId: string;
  critical_days_threshold?: number;
  case_board_id?: string;
  case_public_token?: string;
  case_client_label?: string;
  monday_board_id?: string;
  monday_client_label?: string;
  drive_folder_id?: string;
  active?: boolean;
  portal_password?: string | null;
}

export type CaseGender = 'Feminino' | 'Masculino' | 'Pref. não informar';

export type CaseProcedure =
  | 'Implantes'
  | 'Protocolo'
  | 'Facetas'
  | 'Próteses'
  | 'Orto'
  | 'Estética';

export type CaseStageStatus = 'Fazer' | 'Capturado';

export type CaseStageMoment = 'Planejamento' | 'Procedimento' | 'Entrega' | 'Evento' | 'Agência';

export interface CaseStage {
  id: string;
  boardId: string;
  parentItemId: string;
  title: string;
  moment?: CaseStageMoment | string | null;
  expectedItems?: string[];
  status: CaseStageStatus | string;
  statusColumnId: string;
  filesColumnId: string;
  files: { id: string; name: string; public_url: string; type?: string }[];
  usageLock?: CaseStageUsageLock | null;
}

export interface CaseStageUsageLock {
  id: string;
  editingRequestId?: string | null;
  stageName: string;
  lockedAt: string;
  lockedBy?: string | null;
}

export interface CasePatient {
  id: string;
  boardId: string;
  name: string;
  clientName: string;
  age: number | null;
  birthDate?: string | null;
  gender: CaseGender | string | null;
  procedure: CaseProcedure | string | null;
  procedureDescription: string | null;
  dentistResponsible?: string | null;
  notes: string | null;
  mondayItemId?: string | null;
  driveFolderId?: string | null;
  createdAt: Date | null;
  stages: CaseStage[];
}

export interface TestimonialAsset {
  id: string;
  name: string;
  public_url: string;
}

export interface ReadyTestimonial {
  id: string;
  caseId: string;
  patientName: string;
  mondayItemName?: string | null;
  patientAge?: number | null;
  patientBirthDate?: string | null;
  patientGender?: string | null;
  patientProcedure?: string | null;
  caseCreatedAt?: string | null;
  mondayItemId: string;
  subitemId: string;
  title: string;
  status?: string | null;
  creativeType?: string | null;
  rating?: number | null;
  updatedAt?: string | null;
  assets: TestimonialAsset[];
}

export interface CaseColumnConfig {
  clientColumn: string;
  ageColumn: string;
  genderColumn: string;
  procedureColumn: string;
  procedureDescriptionColumn: string;
  notesColumn: string;
  createdAtColumn: string;
  stageStatusColumn: string;
  stageFilesColumn: string;
}
