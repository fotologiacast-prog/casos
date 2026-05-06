import { CaseColumnConfig, CaseGender, CaseProcedure } from '../types';

export const CASE_STAGE_TITLES = [
  'Fotos do antes',
  'Video panoramico do antes',
  'Video expectativa (paciente e dra.)',
  'Videos do procedimento',
  'Video da entrega (reacao)',
  'Fotos do depois',
  'Video panoramico do depois',
  'Foto com espelho preto',
  'Video depoimento paciente',
  'Explicacao do caso com dr.',
] as const;

export const CASE_GENDERS: CaseGender[] = [
  'Feminino',
  'Masculino',
  'Outro',
  'Prefere nao informar',
];

export const CASE_PROCEDURES: CaseProcedure[] = [
  'Lentes / Facetas',
  'Clareamento',
  'Implante',
  'Protese',
  'Ortodontia',
  'Harmonizacao',
  'Reabilitacao oral',
  'Cirurgia',
  'Outro',
];

export const DEFAULT_CASE_COLUMN_CONFIG: CaseColumnConfig = {
  clientColumn: 'Cliente',
  ageColumn: 'Idade',
  genderColumn: 'Genero',
  procedureColumn: 'Procedimento',
  procedureDescriptionColumn: 'Descricao do procedimento',
  notesColumn: 'Observacoes do caso',
  createdAtColumn: 'Data de cadastro',
  stageStatusColumn: 'Situacao da tarefa',
  stageFilesColumn: 'Arquivos',
};
