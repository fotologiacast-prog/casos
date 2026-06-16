import { CaseColumnConfig, CaseGender, CaseProcedure, CaseStageMoment, ClientPortalType } from '../types';

export const CLIENT_PORTAL_TYPES: Array<{ value: ClientPortalType; label: string; description: string }> = [
  {
    value: 'dental',
    label: 'Dentista',
    description: 'Casos odontológicos com etapas completas de antes, procedimento, entrega e evento.',
  },
  {
    value: 'head_neck',
    label: 'Cirurgião cabeça e pescoço',
    description: 'Consultas médicas com etapas simplificadas para exames, consulta, procedimento e pós-operatório.',
  },
];

export const DEFAULT_CLIENT_PORTAL_TYPE: ClientPortalType = 'dental';

export const normalizeClientPortalType = (value?: string | null): ClientPortalType =>
  value === 'head_neck' ? 'head_neck' : DEFAULT_CLIENT_PORTAL_TYPE;

export const CASE_STAGE_MOMENTS: CaseStageMoment[] = [
  'Planejamento',
  'Procedimento',
  'Entrega',
  'Evento',
  'Agência',
];

export const DENTAL_CASE_STAGE_DEFINITIONS = [
  { title: 'Fotos Intraorais do Antes', moment: 'Planejamento', legacyTitles: ['01. (CADEIRA) Fotos intraorais do antes (4 fotos)'] },
  { title: 'Vídeo Panorâmico do Antes', moment: 'Planejamento', legacyTitles: ['02. (CADEIRA OU ESTÚDIO) Vídeo Panorâmico do Antes', '02. (ESTUDIO) Video panoramico do antes'] },
  { title: 'Retrato Extraoral do Antes', moment: 'Planejamento', legacyTitles: ['03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)'] },
  { title: 'Vídeo Expectativa', moment: 'Planejamento', legacyTitles: ['04. (ESTUDIO) Video expectativa (paciente)'] },
  { title: 'Imagens 3D do Planejamento', moment: 'Procedimento', legacyTitles: ['05. (COMPUTADOR) Imagens 3D do Planejamento', '05. Imagens 3D - Planejamento do laboratorio (escaneamento)'] },
  { title: 'Vídeos do Procedimento', moment: 'Procedimento', legacyTitles: ['06. Videos do procedimento'] },
  { title: 'Fotos Detalhes das Próteses', moment: 'Procedimento', legacyTitles: ['07. Fotos DETALHES em macro das proteses fora da boca'] },
  { title: 'Imagens 3D, Tomografia e RX', moment: 'Procedimento', legacyTitles: ['08. Imagens 3D - Tomografia e RX'] },
  { title: 'Fotos Intraorais do Depois', moment: 'Entrega', legacyTitles: ['09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)'] },
  { title: 'Vídeo da Entrega', moment: 'Entrega', legacyTitles: ['10. (CONSULTORIO) Video da entrega (reacao da paciente no espelho)'] },
  { title: 'Retratos do Depois', moment: 'Entrega', legacyTitles: ['11. (ESTUDIO) Retratos do depois (posados)'] },
  { title: 'Fotos em Close do Sorriso', moment: 'Entrega', legacyTitles: ['12. (ESTUDIO) - Fotos em close do sorriso'] },
  { title: 'Fotos em Close Artísticas do Sorriso', moment: 'Entrega', legacyTitles: ['13. (ESTUDIO) Fotos em close artisticas do sorriso'] },
  { title: 'Vídeo Resultado', moment: 'Entrega', legacyTitles: ['14. (ESTUDIO) Video RESULTADO risada gostosa'] },
  { title: 'Vídeo Depoimento', moment: 'Entrega', legacyTitles: ['15. (ESTUDIO) Video DEPOIMENTO paciente'] },
  { title: 'Vídeo Feedback Emocional da Doutora', moment: 'Entrega', legacyTitles: ['16. (ESTUDIO) Video FEEDBACK EMOCIONAL da dra. pos entrega'] },
  { title: 'Depoimento Produzido', moment: 'Evento', legacyTitles: ['17. Video DEPOIMENTO produzido - videomaker'] },
  { title: 'Retratos Atualizados Lifestyle', moment: 'Evento', legacyTitles: ['18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo'] },
  { title: 'O Brinde da Vitória', moment: 'Evento', legacyTitles: ['19. Foto com o Doutor (O Brinde da Vitoria)'] },
  { title: 'Vídeo de Explicação Técnica', moment: 'Agência', legacyTitles: ['10. Explicação do caso com dr.'] },
] as const;

export const HEAD_NECK_CASE_STAGE_MOMENTS = [
  'Triagem',
  'Consulta',
  'Procedimento',
  'Pós-operatório',
] as const;

export const HEAD_NECK_CASE_STAGE_DEFINITIONS = [
  { title: 'Fotos e Exames Iniciais', moment: 'Triagem', legacyTitles: [] },
  { title: 'Queixa Principal', moment: 'Triagem', legacyTitles: [] },
  { title: 'Arquivos da Consulta', moment: 'Consulta', legacyTitles: [] },
  { title: 'Conduta e Observações', moment: 'Consulta', legacyTitles: [] },
  { title: 'Arquivos do Procedimento', moment: 'Procedimento', legacyTitles: [] },
  { title: 'Fotos de Evolução', moment: 'Pós-operatório', legacyTitles: [] },
  { title: 'Relato ou Depoimento', moment: 'Pós-operatório', legacyTitles: [] },
] as const;

export const CASE_STAGE_DEFINITIONS = DENTAL_CASE_STAGE_DEFINITIONS;

export const getCaseStageDefinitionsForPortalType = (portalType?: string | null) =>
  normalizeClientPortalType(portalType) === 'head_neck'
    ? HEAD_NECK_CASE_STAGE_DEFINITIONS
    : DENTAL_CASE_STAGE_DEFINITIONS;

export const getCaseStageMomentsForPortalType = (portalType?: string | null): string[] =>
  normalizeClientPortalType(portalType) === 'head_neck'
    ? [...HEAD_NECK_CASE_STAGE_MOMENTS]
    : CASE_STAGE_MOMENTS;

export const CASE_STAGE_TITLES = DENTAL_CASE_STAGE_DEFINITIONS.map(stage => stage.title);
export const ALL_CASE_STAGE_TITLES = [
  ...DENTAL_CASE_STAGE_DEFINITIONS.map(stage => stage.title),
  ...HEAD_NECK_CASE_STAGE_DEFINITIONS.map(stage => stage.title),
];

type CaseStageDefinition = ReturnType<typeof getCaseStageDefinitionsForPortalType>[number];

const getLegacyTitles = (stage: CaseStageDefinition) =>
  'legacyTitles' in stage ? stage.legacyTitles as readonly string[] : [];

const getAllCaseStageDefinitions = (): CaseStageDefinition[] => [
  ...DENTAL_CASE_STAGE_DEFINITIONS,
  ...HEAD_NECK_CASE_STAGE_DEFINITIONS,
];

export const getCaseStageMoment = (title: string): string => {
  const definition = getAllCaseStageDefinitions().find(stage => stage.title === title || getLegacyTitles(stage).includes(title));
  return definition?.moment || 'Planejamento';
};

export const getCanonicalCaseStageTitle = (title: string): string => {
  const definition = getAllCaseStageDefinitions().find(stage => stage.title === title || getLegacyTitles(stage).includes(title));
  return definition?.title || title;
};

export const getCaseStageFaqTypes = (title: string): string[] => {
  const definition = getAllCaseStageDefinitions().find(stage => stage.title === title || getLegacyTitles(stage).includes(title));
  return definition ? [definition.title, ...getLegacyTitles(definition)] : [title];
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
  'Facetas / Porcelana',
  'Facetas / Resina',
  'Próteses',
  'Orto',
  'Harmonização Facial',
];

export const HEAD_NECK_CASE_PROCEDURES: CaseProcedure[] = [
  'Consulta',
  'Cirurgia',
  'Biópsia',
  'Retorno',
  'Pós-operatório',
  'Exames / Imagens',
];

export const getCaseProceduresForPortalType = (portalType?: string | null): CaseProcedure[] =>
  normalizeClientPortalType(portalType) === 'head_neck'
    ? HEAD_NECK_CASE_PROCEDURES
    : CASE_PROCEDURES;

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
