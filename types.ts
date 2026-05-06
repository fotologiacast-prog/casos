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
  avatar_url?: string;
  critical_days_threshold?: number;
  case_board_id?: string;
  case_public_token?: string;
  case_client_label?: string;
  monday_board_id?: string;
  monday_client_label?: string;
  drive_folder_id?: string;
  active?: boolean;
}

export type CaseGender = 'Feminino' | 'Masculino' | 'Outro' | 'Prefere nao informar';

export type CaseProcedure =
  | 'Lentes / Facetas'
  | 'Clareamento'
  | 'Implante'
  | 'Protese'
  | 'Ortodontia'
  | 'Harmonizacao'
  | 'Reabilitacao oral'
  | 'Cirurgia'
  | 'Outro';

export type CaseStageStatus = 'Fazer' | 'Capturado';

export type CaseStageMoment = 'Planejamento' | 'Procedimento' | 'Entrega' | 'Evento';

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
}

export interface CasePatient {
  id: string;
  boardId: string;
  name: string;
  clientName: string;
  age: number | null;
  gender: CaseGender | string | null;
  procedure: CaseProcedure | string | null;
  procedureDescription: string | null;
  notes: string | null;
  createdAt: Date | null;
  stages: CaseStage[];
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
