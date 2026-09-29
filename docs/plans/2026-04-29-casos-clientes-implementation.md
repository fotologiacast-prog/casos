# Portal de Casos de Clientes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public per-client portal where dentists create patient cases, the app creates the Monday item plus 10 default subitems, and clients can track/upload files by case stage.

**Architecture:** Reuse the existing React/Vite app, Monday proxy, and Monday service layer. Add a case-focused domain layer that maps Monday board items/subitems to `CasePatient` and `CaseStage`, then add public routes for the client portal, patient creation, and patient stage upload.

**Tech Stack:** React 19, TypeScript, Vite, Monday GraphQL API via `/api/monday`, Supabase for existing client records and public-link metadata, Tailwind CDN styles already present in `index.html`.

---

### Task 1: Add Case Domain Types And Constants

**Files:**
- Modify: `types.ts`
- Create: `utils/caseConstants.ts`

**Step 1: Add types**

Add these interfaces to `types.ts`:

```ts
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

export interface CaseStage {
  id: string;
  boardId: string;
  parentItemId: string;
  title: string;
  status: CaseStageStatus | string;
  statusColumnId: string;
  filesColumnId: string;
  files: { id: string; name: string; public_url: string }[];
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
```

**Step 2: Add constants**

Create `utils/caseConstants.ts`:

```ts
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
```

**Step 3: Verify**

Run: `npm run build`

Expected: TypeScript compiles or reports only the next missing imports once later tasks reference these types.

---

### Task 2: Add Monday Subitem And Column Helpers

**Files:**
- Modify: `services/mondayService.ts`

**Step 1: Add helper exports**

Add functions:

```ts
export async function createSubitem(parentItemId: string, itemName: string, columnValues?: any): Promise<string> {
  const mutation = `mutation ($parentItemId: ID!, $itemName: String!, $columnValues: JSON) {
    create_subitem(parent_item_id: $parentItemId, item_name: $itemName, column_values: $columnValues) { id board { id } }
  }`;
  const result = await mondayFetch(mutation, {
    parentItemId: String(parentItemId),
    itemName,
    columnValues: columnValues ? JSON.stringify(columnValues) : undefined,
  });
  return result.data.create_subitem.id;
}

export async function fetchItemWithSubitems(itemId: string) {
  const query = `query ($itemIds: [ID!]) {
    items(ids: $itemIds) {
      id
      name
      board { id }
      assets { id name public_url }
      column_values { id text value column { title } }
      subitems {
        id
        name
        board { id }
        assets { id name public_url }
        column_values { id text value column { title } }
      }
    }
  }`;
  const result = await mondayFetch(query, { itemIds: [String(itemId)] });
  return result.data?.items?.[0] || null;
}
```

**Step 2: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 3: Add Case Monday Service

**Files:**
- Create: `services/caseMondayService.ts`

**Step 1: Implement column mapping and normalization**

Create helpers to:

- find a column value by title;
- find a board column id by title;
- map Monday items to `CasePatient`;
- calculate stage files from subitem `assets`;
- calculate status from `Situacao da tarefa`.

**Step 2: Implement case creation**

Expose:

```ts
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
}): Promise<string>
```

Implementation:

1. Fetch board columns with `fetchBoardColumns(boardId)`.
2. Build `columnValues` using detected ids.
3. Call `createItem(boardId, input.name, columnValues)`.
4. Create the 10 subitems with `createSubitem`.
5. Set each subitem `Situacao da tarefa` to `Fazer` when the status column exists.
6. Return the created parent item id.

**Step 3: Implement case list loading**

Expose:

```ts
export async function fetchCasePatients(boardId: string, clientName: string, config?: CaseColumnConfig): Promise<CasePatient[]>
```

Implementation:

1. Fetch board data.
2. Filter items whose `Cliente` column matches `clientName`.
3. Normalize each item and subitem to `CasePatient`.
4. Sort by `createdAt` descending, then by name.

**Step 4: Implement upload to stage**

Expose:

```ts
export async function uploadCaseStageFiles(stage: CaseStage, files: File[]): Promise<void>
```

Implementation:

1. Upload every file with `uploadFileToItem(stage.id, stage.filesColumnId, file)`.
2. Change status with `updateItemStatus(stage.boardId, stage.id, stage.statusColumnId, 'Capturado')`.

**Step 5: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 4: Add Public Link Metadata To Clients

**Files:**
- Modify: `types.ts`
- Modify: `services/supabaseService.ts`
- Modify: `components/ClientForm.tsx`

**Step 1: Extend client type**

Add optional fields:

```ts
case_board_id?: string;
case_public_token?: string;
case_client_label?: string;
```

**Step 2: Add lookup function**

In `services/supabaseService.ts`, add:

```ts
export async function getClientByCaseToken(token: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('case_public_token', token)
    .maybeSingle();
  if (error) throw new Error(`Erro ao buscar cliente pelo link de casos: ${getErrorMessage(error)}`);
  return data;
}
```

**Step 3: Add admin fields**

In `ClientForm.tsx`, add inputs for:

- `case_board_id`
- `case_public_token`
- `case_client_label`

Generate a suggested token client-side when creating a new client if empty.

**Step 4: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 5: Add Case Portal Route

**Files:**
- Modify: `App.tsx`
- Create: `components/cases/CasePortal.tsx`

**Step 1: Route by hash**

In `App.tsx`, detect:

```ts
const caseRouteMatch = route.match(/^#\/casos\/([^/?]+)/);
```

If matched, render:

```tsx
<CasePortal token={caseRouteMatch[1]} />
```

before the current calendar/admin routes.

**Step 2: Portal loading**

`CasePortal` should:

1. Call `getClientByCaseToken(token)`.
2. Use `client.case_board_id || client.boardId` as board id.
3. Use `client.case_client_label || client.name` as Monday client label.
4. Load patients with `fetchCasePatients`.
5. Render loading, error, empty, list, create form, and detail states.

**Step 3: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 6: Build Patient List, Filters, And Cards

**Files:**
- Create: `components/cases/CasePatientList.tsx`
- Create: `components/cases/CasePatientCard.tsx`

**Step 1: Add filters**

Support:

- search by patient name;
- month filter from `createdAt`;
- case status filter:
  - `Todos`
  - `Em andamento`
  - `Completo`
  - `Com pendencias`
- gender filter;
- age range filter;
- procedure filter.

**Step 2: Add card progress logic**

Calculate:

```ts
const captured = patient.stages.filter(stage => stage.status === 'Capturado' || stage.files.length > 0).length;
const total = patient.stages.length || CASE_STAGE_TITLES.length;
```

Show:

- patient name;
- created date;
- age/gender;
- procedure;
- progress text and bar;
- clear action to open patient.

**Step 3: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 7: Build New Patient Form

**Files:**
- Create: `components/cases/NewCasePatientForm.tsx`

**Step 1: Add fields**

Fields:

- `Nome do paciente` required;
- `Idade` required number;
- `Genero` required select;
- `Procedimento` required select;
- `Descricao do procedimento` optional textarea;
- `Observacoes do caso` optional textarea.

**Step 2: Submit behavior**

On submit:

1. Disable submit button.
2. Call `createCasePatient`.
3. Show success state.
4. Refresh patient list.
5. Return to list.

**Step 3: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 8: Build Patient Stage Detail Screen

**Files:**
- Create: `components/cases/CasePatientDetail.tsx`
- Create: `components/cases/CaseStageCard.tsx`

**Step 1: Render patient summary**

Show:

- back button;
- patient name;
- created date;
- age/gender;
- procedure and description;
- progress count.

**Step 2: Render 10 stage cards**

For each stage:

- show stage title;
- show `Fazer` or `Capturado`;
- show whether files exist;
- show file count and filenames;
- show upload button.

If Monday returns missing subitems, render placeholder cards and show a non-blocking warning.

**Step 3: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 9: Add Stage Upload Flow

**Files:**
- Modify: `components/cases/CaseStageCard.tsx`
- Modify: `components/cases/CasePatientDetail.tsx`

**Step 1: Add file picker**

Allow image and video files:

```tsx
<input type="file" multiple accept="image/*,video/*" />
```

**Step 2: Upload**

Call `uploadCaseStageFiles(stage, files)` and show:

- uploading state;
- success state;
- error message with retry;
- refreshed patient data after upload.

**Step 3: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 10: Add Link Generator For Case Portal

**Files:**
- Modify: `components/LinkGeneratorModal.tsx` or create `components/cases/CaseLinkGenerator.tsx`
- Modify: `components/ClientForm.tsx`

**Step 1: Generate case link**

Use:

```ts
`${window.location.origin}${window.location.pathname}#/casos/${client.case_public_token}`
```

**Step 2: Admin display**

Show a copyable "Link de casos" for clients that have `case_public_token`.

**Step 3: Verify**

Run: `npm run build`

Expected: PASS.

---

### Task 11: Manual End-To-End Verification

**Files:**
- No code changes unless bugs are found.

**Step 1: Start app**

Run: `npm run dev`

Expected: Vite serves the app.

**Step 2: Open case portal**

Open: `http://localhost:5173/#/casos/<token>`

Expected:

- client loads;
- patient list appears;
- filters work without errors.

**Step 3: Create patient**

Create a patient with:

- name: `Paciente Teste`
- age: `42`
- gender: `Feminino`
- procedure: `Lentes / Facetas`

Expected:

- Monday item is created;
- all 10 subitems are created with status `Fazer`;
- patient card appears in portal.

**Step 4: Upload files**

Upload an image to `Fotos do antes`.

Expected:

- file appears in the Monday subitem;
- stage status becomes `Capturado`;
- patient progress becomes `1/10`.

**Step 5: Build**

Run: `npm run build`

Expected: PASS.

