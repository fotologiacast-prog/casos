import { CaseColumnConfig, CaseGender, CaseProcedure, CaseStageMoment } from '../types';

export const CASE_STAGE_MOMENTS: CaseStageMoment[] = [
  'Planejamento',
  'Procedimento',
  'Entrega',
  'Evento',
];

export const CASE_STAGE_DEFINITIONS = [
  {
    title: 'Planejamento',
    moment: 'Planejamento',
    expectedItems: [
      '01. (CADEIRA) Fotos intraorais do antes (4 fotos)',
      '02. (ESTUDIO) Video panoramico do antes',
      '03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)',
      '04. (ESTUDIO) Video expectativa (paciente)',
    ],
  },
  {
    title: 'Procedimento',
    moment: 'Procedimento',
    expectedItems: [
      '05. Imagens 3D - Planejamento do laboratorio (escaneamento)',
      '06. Videos do procedimento',
      '07. Fotos DETALHES em macro das proteses fora da boca',
      '08. Imagens 3D - Tomografia e RX',
    ],
  },
  {
    title: 'Entrega',
    moment: 'Entrega',
    expectedItems: [
      '09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)',
      '10. (CONSULTORIO) Video da entrega (reacao da paciente no espelho)',
      '11. (ESTUDIO) Retratos do depois (posados)',
      '12. (ESTUDIO) - Fotos em close do sorriso',
      '13. (ESTUDIO) Fotos em close artisticas do sorriso',
      '14. (ESTUDIO) Video RESULTADO risada gostosa',
      '15. (ESTUDIO) Video DEPOIMENTO paciente',
      '16. (ESTUDIO) Video FEEDBACK EMOCIONAL da dra. pos entrega',
    ],
  },
  {
    title: 'Evento',
    moment: 'Evento',
    expectedItems: [
      '17. Video DEPOIMENTO produzido - videomaker',
      '18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo',
      '19. Foto com o Doutor (O Brinde da Vitoria)',
    ],
  },
] as const;

export const CASE_STAGE_TITLES = CASE_STAGE_DEFINITIONS.map(stage => stage.title);

export const getCaseStageMoment = (title: string): CaseStageMoment => {
  const definition = CASE_STAGE_DEFINITIONS.find(stage => stage.title === title);
  return (definition?.moment || 'Planejamento') as CaseStageMoment;
};

export const getCaseStageExpectedItems = (title: string): string[] => {
  const definition = CASE_STAGE_DEFINITIONS.find(stage => stage.title === title);
  return definition ? [...definition.expectedItems] : [];
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
