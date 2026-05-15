
import { MondayApiResponse, Item } from '../types';

const BACKEND_PROXY_URL = "/api/monday";
const BACKEND_UPLOAD_URL = "/api/monday";
const CACHE_TTL = 30 * 1000; 
const memoryCache = new Map<string, { data: MondayApiResponse; timestamp: number }>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrapper de Fetch com logs para depuração
 */
async function mondayFetch(query: string, variables: any = {}) {
  console.log("[Monday API] Chamando proxy: Query GraphQL");
  
  try {
    const options: RequestInit = {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    };

    const response = await fetch(BACKEND_PROXY_URL, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Monday API] Erro no Proxy (${response.status}):`, errorText);
      throw new Error(`Erro no servidor (${response.status}). Verifique o console do desenvolvedor.`);
    }

    const result = await response.json();
    
    if (result.errors) {
      console.warn("[Monday API] A API retornou erros de GraphQL:", result.errors);
      throw new Error(result.errors.map((e: any) => e.message).join(', '));
    }

    return result;
  } catch (error) {
    console.error("[Monday API] Exceção durante a requisição:", error);
    throw error;
  }
}

export async function fetchBoardColumns(boardId: string): Promise<{ id: string; title: string; type: string }[]> {
  const query = `query ($boardIds: [ID!]) { boards(ids: $boardIds) { columns { id title type } } }`;
  try {
    const result = await mondayFetch(query, { boardIds: [String(boardId)] });
    return result.data?.boards?.[0]?.columns || [];
  } catch (e) {
    return [];
  }
}

export async function fetchBoardData(boardId: string, groupIds?: string[], forceRefresh: boolean = false, columnIds?: string[]): Promise<MondayApiResponse> {
  const cacheKey = `${boardId}-${groupIds ? groupIds.join(',') : 'all'}`;

  if (!forceRefresh && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  }

  const query = `
    query ($boardIds: [ID!], $cursor: String${columnIds ? ', $columnIds: [String!]' : ''}) {
      boards(ids: $boardIds) {
        id
        name
        columns { id title type }
        items_page(limit: 100, cursor: $cursor) {
          cursor
          items {
            id
            name
            group { id title }
            column_values${columnIds ? '(ids: $columnIds)' : ''} {
              id text value
              column { title }
            }
            subitems {
              id name
              board { id }
              assets { id name public_url }
              column_values${columnIds ? '(ids: $columnIds)' : ''} {
                id text value
                column { title }
              }
            }
          }
        }
      }
    }
  `;

  let allItems: Item[] = [];
  let boardDetails: any = null;
  let cursor: string | null = null;
  let pageCount = 0;

  do {
    const maxRetries = 3;
    let pageFetched = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await mondayFetch(query, { boardIds: [String(boardId)], cursor, ...(columnIds ? { columnIds } : {}) });
        const boardData = result.data?.boards?.[0];
        
        if (!boardData) {
          if (allItems.length === 0) throw new Error("Board não encontrado ou sem permissão.");
          cursor = null;
          pageFetched = true;
          break;
        }

        if (!boardDetails) boardDetails = { id: boardData.id, name: boardData.name, columns: boardData.columns };
        if (boardData.items_page?.items) allItems.push(...boardData.items_page.items);
        
        cursor = boardData.items_page?.cursor || null;
        pageFetched = true;
        break;
      } catch (error: any) {
        if (attempt === maxRetries) throw error;
        await sleep(1000 * attempt);
      }
    }
    pageCount++;
    if (!pageFetched || pageCount >= 15) break;
  } while (cursor);

  if (!boardDetails) throw new Error("Falha ao recuperar dados do quadro.");

  const finalResponse: MondayApiResponse = {
    data: { boards: [{ ...boardDetails, items: allItems }] }
  };

  memoryCache.set(cacheKey, { data: finalResponse, timestamp: Date.now() });

  return finalResponse;
}

export async function updateItemStatus(boardId: string, itemId: string, columnId: string, statusLabel: string): Promise<void> {
  const mutation = `mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) { change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id } }`;
  await mondayFetch(mutation, { boardId: String(boardId), itemId: String(itemId), columnId, value: JSON.stringify({ label: statusLabel }) });
}

export async function createItem(boardId: string, itemName: string, columnValues?: any): Promise<string> {
  const mutation = `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON) { 
    create_item (board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id } 
  }`;
  const result = await mondayFetch(mutation, { 
    boardId: String(boardId), 
    itemName, 
    columnValues: columnValues ? JSON.stringify(columnValues) : undefined 
  });
  return result.data.create_item.id;
}

export async function createSubitem(parentItemId: string, itemName: string, columnValues?: any): Promise<string> {
  const mutation = `mutation ($parentItemId: ID!, $itemName: String!, $columnValues: JSON) {
    create_subitem(parent_item_id: $parentItemId, item_name: $itemName, column_values: $columnValues) {
      id
    }
  }`;
  const result = await mondayFetch(mutation, {
    parentItemId: String(parentItemId),
    itemName,
    columnValues: columnValues ? JSON.stringify(columnValues) : undefined,
  });
  return result.data.create_subitem.id;
}

export async function fetchItemWithSubitems(itemId: string): Promise<Item | null> {
  const query = `query ($itemIds: [ID!]) {
    items(ids: $itemIds) {
      id
      name
      board { id }
      assets { id name public_url }
      column_values {
        id text value
        column { title }
      }
      subitems {
        id
        name
        board { id }
        assets { id name public_url }
        column_values {
          id text value
          column { title }
        }
      }
    }
  }`;
  const result = await mondayFetch(query, { itemIds: [String(itemId)] });
  return result.data?.items?.[0] || null;
}

export async function uploadFileToItem(itemId: string, columnId: string, file: File): Promise<void> {
  const query = `mutation addFile($itemId: ID!, $columnId: String!, $file: File!) { add_file_to_column(item_id: $itemId, column_id: $columnId, file: $file) { id } }`;
  const operations = JSON.stringify({ query, variables: { itemId: String(itemId), columnId, file: null } });
  const map = JSON.stringify({ "0": ["variables.file"] });
  const formData = new FormData();
  formData.append('operations', operations);
  formData.append('map', map);
  formData.append('0', file, file.name);

  const response = await fetch('/api/monday', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Monday Upload] Erro no Proxy (${response.status}):`, errorText);
    throw new Error(`Erro ao enviar arquivo (${response.status}).`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors.map((e: any) => e.message).join(', '));
  }
}
