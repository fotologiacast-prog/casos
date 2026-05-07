import { CaseColumnConfig, CaseGender, CaseProcedure, CaseStageMoment } from '../types';

export const CASE_STAGE_MOMENTS: CaseStageMoment[] = [
  'Planejamento',
  'Procedimento',
  'Entrega',
  'Evento',
];

export const CASE_STAGE_DEFINITIONS = [
  { title: '01. (CADEIRA) Fotos intraorais do antes (4 fotos)', moment: 'Planejamento' },
  { title: '02. (ESTUDIO) Video panoramico do antes', moment: 'Planejamento' },
  { title: '03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)', moment: 'Planejamento' },
  { title: '04. (ESTUDIO) Video expectativa (paciente)', moment: 'Planejamento' },
  { title: '05. Imagens 3D - Planejamento do laboratorio (escaneamento)', moment: 'Procedimento' },
  { title: '06. Videos do procedimento', moment: 'Procedimento' },
  { title: '07. Fotos DETALHES em macro das proteses fora da boca', moment: 'Procedimento' },
  { title: '08. Imagens 3D - Tomografia e RX', moment: 'Procedimento' },
  { title: '09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)', moment: 'Entrega' },
  { title: '10. (CONSULTORIO) Video da entrega (reacao da paciente no espelho)', moment: 'Entrega' },
  { title: '11. (ESTUDIO) Retratos do depois (posados)', moment: 'Entrega' },
  { title: '12. (ESTUDIO) - Fotos em close do sorriso', moment: 'Entrega' },
  { title: '13. (ESTUDIO) Fotos em close artisticas do sorriso', moment: 'Entrega' },
  { title: '14. (ESTUDIO) Video RESULTADO risada gostosa', moment: 'Entrega' },
  { title: '15. (ESTUDIO) Video DEPOIMENTO paciente', moment: 'Entrega' },
  { title: '16. (ESTUDIO) Video FEEDBACK EMOCIONAL da dra. pos entrega', moment: 'Entrega' },
  { title: '17. Video DEPOIMENTO produzido - videomaker', moment: 'Evento' },
  { title: '18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo', moment: 'Evento' },
  { title: '19. Foto com o Doutor (O Brinde da Vitoria)', moment: 'Evento' },
] as const;

export const CASE_STAGE_TITLES = CASE_STAGE_DEFINITIONS.map(stage => stage.title);

export const getCaseStageMoment = (title: string): CaseStageMoment => {
  const definition = CASE_STAGE_DEFINITIONS.find(stage => stage.title === title);
  return (definition?.moment || 'Planejamento') as CaseStageMoment;
};

export const getCaseStageExpectedItems = (title: string): string[] => {
  return [];
};

export const CASE_GENDERS: CaseGender[] = [
  'Feminino',
  'Masculino',
  'Pref. não informar',
];

export const CASE_PROCEDURES: CaseProcedure[] = [
  'Implantes',
  'Protocolo',
  'Facetas',
  'Próteses',
  'Orto',
  'Estética',
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
