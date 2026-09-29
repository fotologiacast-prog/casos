import { Board, CaseColumnConfig, CasePatient, CaseStage, ColumnValue, Item } from '../types';
import { CASE_STAGE_TITLES, DEFAULT_CASE_COLUMN_CONFIG } from '../utils/caseConstants';
import {
  createItem,
  createSubitem,
  fetchBoardColumns,
  fetchBoardData,
  fetchItemWithSubitems,
  updateItemStatus,
  uploadFileToItem,
} from './mondayService';

type MondayColumn = { id: string; title: string; type: string };

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const findColumnValue = (item: Item, columnName: string): ColumnValue | undefined => {
  const target = normalizeKey(columnName);
  return item.column_values?.find(value => normalizeKey(value.column.title) === target);
};

const findBoardColumn = (columns: MondayColumn[], columnName: string): MondayColumn | undefined => {
  const target = normalizeKey(columnName);
  return columns.find(column => normalizeKey(column.title) === target);
};

const isMeaningful = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const formatColumnValue = (column: MondayColumn | undefined, value: unknown) => {
  if (!column || !isMeaningful(value)) return undefined;

  const text = String(value).trim();
  const type = column.type;

  if (type === 'status' || type === 'color') return { label: text };
  if (type === 'dropdown') return { labels: [text] };
  if (type === 'date') return { date: text };
  if (type === 'long_text' || type === 'long-text') return { text };
  if (type === 'numbers' || type === 'numeric') return text;

  return text;
};

const addColumnValue = (target: Record<string, unknown>, column: MondayColumn | undefined, value: unknown) => {
  const formatted = formatColumnValue(column, value);
  if (column && formatted !== undefined) {
    target[column.id] = formatted;
  }
};

const parseDateValue = (columnValue: ColumnValue | undefined): Date | null => {
  if (!columnValue) return null;

  try {
    const parsed = JSON.parse(columnValue.value);
    if (parsed?.date) {
      const date = new Date(`${parsed.date}T00:00:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  } catch (e) {
    // Monday date text is enough when value is not JSON.
  }

  if (!columnValue.text) return null;
  const date = new Date(`${columnValue.text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseNumberValue = (columnValue: ColumnValue | undefined): number | null => {
  const raw = columnValue?.text?.trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const extractFiles = (item: Item, filesColumn: ColumnValue | undefined): CaseStage['files'] => {
  const assets = item.assets || [];
  if (!filesColumn?.value) return assets;

  try {
    const parsed = JSON.parse(filesColumn.value);
    const ids = new Set((parsed?.files || []).map((file: any) => String(file.assetId)).filter(Boolean));
    if (ids.size > 0) {
      return assets.filter(asset => ids.has(String(asset.id)));
    }
  } catch (e) {
    // If Monday changes the files payload, showing assets is still better than hiding uploads.
  }

  return assets;
};

const normalizeCasePatient = (
  boardId: string,
  item: Item,
  clientName: string,
  config: CaseColumnConfig
): CasePatient => {
  const ageValue = findColumnValue(item, config.ageColumn);
  const genderValue = findColumnValue(item, config.genderColumn);
  const procedureValue = findColumnValue(item, config.procedureColumn);
  const procedureDescriptionValue = findColumnValue(item, config.procedureDescriptionColumn);
  const notesValue = findColumnValue(item, config.notesColumn);
  const createdAtValue = findColumnValue(item, config.createdAtColumn);

  const stages: CaseStage[] = (item.subitems || []).map(subitem => {
    const statusValue = findColumnValue(subitem, config.stageStatusColumn);
    const filesValue = findColumnValue(subitem, config.stageFilesColumn);

    return {
      id: subitem.id,
      boardId: String(subitem.board?.id || boardId),
      parentItemId: item.id,
      title: subitem.name,
      status: statusValue?.text?.trim() || 'Fazer',
      statusColumnId: statusValue?.id || '',
      filesColumnId: filesValue?.id || '',
      files: extractFiles(subitem, filesValue),
    };
  });

  return {
    id: item.id,
    boardId,
    name: item.name,
    clientName,
    age: parseNumberValue(ageValue),
    gender: genderValue?.text || null,
    procedure: procedureValue?.text || null,
    procedureDescription: procedureDescriptionValue?.text || null,
    notes: notesValue?.text || null,
    createdAt: parseDateValue(createdAtValue),
    stages,
  };
};

const getClientColumnText = (item: Item, config: CaseColumnConfig) =>
  findColumnValue(item, config.clientColumn)?.text?.trim() || '';

const sortPatients = (patients: CasePatient[]) =>
  patients.sort((a, b) => {
    const aTime = a.createdAt?.getTime() || 0;
    const bTime = b.createdAt?.getTime() || 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

export async function fetchCasePatients(
  boardId: string,
  clientName: string,
  config: CaseColumnConfig = DEFAULT_CASE_COLUMN_CONFIG,
  forceRefresh = true
): Promise<CasePatient[]> {
  const response = await fetchBoardData(boardId, undefined, forceRefresh);
  const board = response.data.boards[0] as Board | undefined;
  if (!board?.items) return [];

  const clientKey = normalizeKey(clientName);
  const patients = board.items
    .filter(item => normalizeKey(getClientColumnText(item, config)) === clientKey)
    .map(item => normalizeCasePatient(String(board.id), item, clientName, config));

  return sortPatients(patients);
}

export async function fetchCasePatient(
  itemId: string,
  clientName: string,
  config: CaseColumnConfig = DEFAULT_CASE_COLUMN_CONFIG
): Promise<CasePatient | null> {
  const item = await fetchItemWithSubitems(itemId);
  if (!item) return null;

  return normalizeCasePatient(String(item.board?.id || ''), item, clientName, config);
}

export async function createCasePatient(input: {
  boardId: string;
  clientName: string;
  name: string;
  age: number;
  gender: string;
  procedure: string;
  procedureDescription: string;
  notes: string;
  config?: CaseColumnConfig;
}): Promise<string> {
  const config = input.config || DEFAULT_CASE_COLUMN_CONFIG;
  const columns = await fetchBoardColumns(input.boardId);

  const columnValues: Record<string, unknown> = {};
  addColumnValue(columnValues, findBoardColumn(columns, config.clientColumn), input.clientName);
  addColumnValue(columnValues, findBoardColumn(columns, config.ageColumn), input.age);
  addColumnValue(columnValues, findBoardColumn(columns, config.genderColumn), input.gender);
  addColumnValue(columnValues, findBoardColumn(columns, config.procedureColumn), input.procedure);
  addColumnValue(columnValues, findBoardColumn(columns, config.procedureDescriptionColumn), input.procedureDescription);
  addColumnValue(columnValues, findBoardColumn(columns, config.notesColumn), input.notes);
  addColumnValue(columnValues, findBoardColumn(columns, config.createdAtColumn), new Date().toISOString().slice(0, 10));

  const parentItemId = await createItem(input.boardId, input.name.trim(), columnValues);

  await Promise.all(CASE_STAGE_TITLES.map(title => createSubitem(parentItemId, title)));

  const createdItem = await fetchItemWithSubitems(parentItemId);
  const statusUpdates = (createdItem?.subitems || [])
    .map(subitem => {
      const statusValue = findColumnValue(subitem, config.stageStatusColumn);
      const subitemBoardId = subitem.board?.id;
      if (!statusValue?.id || !subitemBoardId) return null;
      return updateItemStatus(String(subitemBoardId), subitem.id, statusValue.id, 'Fazer');
    })
    .filter((promise): promise is Promise<void> => promise !== null);

  await Promise.all(statusUpdates);

  return parentItemId;
}

export async function uploadCaseStageFiles(stage: CaseStage, files: File[]): Promise<void> {
  if (!stage.filesColumnId) {
    throw new Error('Coluna de arquivos nao encontrada para esta etapa.');
  }
  if (!stage.statusColumnId) {
    throw new Error('Coluna de status nao encontrada para esta etapa.');
  }

  for (const file of files) {
    await uploadFileToItem(stage.id, stage.filesColumnId, file);
  }

  await updateItemStatus(stage.boardId, stage.id, stage.statusColumnId, 'Capturado');
}
