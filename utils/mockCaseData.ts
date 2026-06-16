import { CasePatient } from '../types';
import { CASE_STAGE_DEFINITIONS } from './caseConstants';

const sampleImages = [
  'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80',
];

const makeStages = (parentItemId: string, capturedIndexes: number[]) =>
  CASE_STAGE_DEFINITIONS.map((stage, index) => {
    const captured = capturedIndexes.includes(index);
    const isVideoStage = stage.title.toLowerCase().includes('video');
    return {
      id: `${parentItemId}-stage-${index + 1}`,
      boardId: 'demo-board',
      parentItemId,
      title: stage.title,
      moment: stage.moment,
      expectedItems: [],
      status: captured ? 'Capturado' : 'Fazer',
      statusColumnId: 'demo-status',
      filesColumnId: 'demo-files',
      files: captured
        ? [
            {
              id: `${parentItemId}-file-${index + 1}`,
              name: isVideoStage ? 'video-captura.mp4' : 'foto-sorriso.jpg',
              public_url: isVideoStage ? '#' : sampleImages[index % sampleImages.length],
              type: isVideoStage ? 'video/mp4' : 'image/jpeg',
            },
          ]
        : [],
    };
  });

export const MOCK_CASE_PATIENTS: CasePatient[] = [
  {
    id: 'demo-maria',
    boardId: 'demo-board',
    name: 'Maria Eduarda',
    clientName: 'Clínica Demo',
    age: 42,
    gender: 'Feminino',
    procedure: 'Facetas / Porcelana',
    procedureDescription: 'Reabilitação estética com lentes superiores e ajuste de proporção do sorriso.',
    notes: 'Paciente autorizou uso do caso e topou gravar depoimento curto.',
    createdAt: new Date('2026-04-11T00:00:00'),
    stages: makeStages('demo-maria', [0, 1, 5]),
  },
  {
    id: 'demo-carlos',
    boardId: 'demo-board',
    name: 'Carlos Henrique',
    clientName: 'Clínica Demo',
    age: 58,
    gender: 'Masculino',
    procedure: 'Implante',
    procedureDescription: 'Protocolo inferior com registro de antes, procedimento e entrega.',
    notes: '',
    createdAt: new Date('2026-03-26T00:00:00'),
    stages: makeStages('demo-carlos', [0, 2, 3, 4, 5, 6, 8]),
  },
  {
    id: 'demo-ana',
    boardId: 'demo-board',
    name: 'Ana Paula',
    clientName: 'Clínica Demo',
    age: 31,
    gender: 'Feminino',
    procedure: 'Clareamento',
    procedureDescription: 'Clareamento acompanhado de fotos comparativas.',
    notes: 'Caso simples para postagem de resultado.',
    createdAt: new Date('2026-04-22T00:00:00'),
    stages: makeStages('demo-ana', []),
  },
];
