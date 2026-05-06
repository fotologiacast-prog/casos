# Portal de Casos de Clientes

App React/Vite para dentistas cadastrarem casos de pacientes sem acessar o Monday.

Cada cliente recebe um link publico exclusivo. O app carrega os pacientes daquele cliente, permite criar novos casos e envia os arquivos das etapas para subitens no Monday.

## Fluxo

1. O cliente acessa `#/casos/<token-do-cliente>`.
2. O app identifica o cliente no Supabase.
3. O cliente cadastra um paciente.
4. O app cria o item principal no Monday.
5. O app cria automaticamente 10 subitens de captura.
6. Cada upload em uma etapa vai para o subitem correspondente e muda o status para `Capturado`.

## Colunas esperadas no item principal

- `Cliente`
- `Idade`
- `Genero`
- `Procedimento`
- `Descricao do procedimento`
- `Observacoes do caso`
- `Data de cadastro`

## Colunas esperadas nos subitens

- `Situacao da tarefa`
- `Arquivos`

## Etapas criadas automaticamente

1. `Fotos do antes`
2. `Video panoramico do antes`
3. `Video expectativa (paciente e dra.)`
4. `Videos do procedimento`
5. `Video da entrega (reacao)`
6. `Fotos do depois`
7. `Video panoramico do depois`
8. `Foto com espelho preto`
9. `Video depoimento paciente`
10. `Explicacao do caso com dr.`

## Supabase

Este app deve usar um Supabase proprio ou uma tabela nova limpa. Nao reutilize a tabela antiga do app de criativos sem migrar os campos.

Crie a tabela com o SQL em:

```text
docs/supabase-schema.sql
```

Esse schema bloqueia leitura direta da tabela para usuarios anonimos e libera apenas a busca por token via RPC `get_client_by_case_token`.

A tabela `clients` deve conter:

- `name`: nome visivel do cliente.
- `boardId`: fallback para o board do Monday.
- `case_public_token`: token usado no link publico.
- `case_board_id`: board central de casos, opcional. Se vazio, o app usa `boardId`.
- `case_client_label`: nome que deve ser gravado na coluna `Cliente` do Monday, opcional. Se vazio, o app usa `name`.
- `drive_folder_id`: ID da pasta do cliente no Google Drive, opcional no inicio. Se vazio, o backend podera criar uma pasta dentro da pasta raiz e salvar esse ID depois.

## Rodar localmente

```bash
npm install
npm run dev
```

O Vite roda em `http://localhost:3000`.

## Admin de clientes

Depois de configurar `ADMIN_PASSWORD`, acesse:

```text
/#/admin/clientes
```

Essa tela cadastra o mapa de cada cliente:

- nome;
- token do link publico;
- board do Monday;
- label do cliente no Monday;
- pasta do Google Drive;
- avatar opcional.

## Variaveis de ambiente

Os proxies em `api/monday.ts` e `api/monday-upload.ts` precisam de:

```bash
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_anon_key_do_supabase
MONDAY_TOKEN=seu_token_do_monday
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_para_admin
ADMIN_PASSWORD=sua_senha_do_admin
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=sua_chave_google_em_base64
DRIVE_ROOT_FOLDER_ID=1aUtI6yDclwJVxIktMKsewuwnrAgSLWLX
VITE_DRIVE_ROOT_FOLDER_ID=1aUtI6yDclwJVxIktMKsewuwnrAgSLWLX
VITE_DRIVE_SERVICE_ACCOUNT_EMAIL=drive-uploader@smash-balloon-479213.iam.gserviceaccount.com
VITE_DEFAULT_MONDAY_CASE_BOARD_ID=18411843992
```

## Upload de arquivos

O navegador nunca envia arquivos direto para `https://api.monday.com/v2/file`.

Fluxo usado:

1. O frontend envia `multipart/form-data` para `/api/monday-upload`.
2. O backend encaminha o stream para `https://api.monday.com/v2/file` com `MONDAY_TOKEN`.
3. O Monday grava o arquivo na coluna `Arquivos` do subitem.

Isso evita CORS no browser e mantem o token fora do frontend.

## Google Drive

Pasta raiz configurada:

```bash
DRIVE_ROOT_FOLDER_ID=1aUtI6yDclwJVxIktMKsewuwnrAgSLWLX
DRIVE_SERVICE_ACCOUNT_EMAIL=drive-uploader@smash-balloon-479213.iam.gserviceaccount.com
```

A pasta raiz `Casos de Clientes` deve estar compartilhada como `Editor` com o e-mail da service account.

O arquivo JSON da service account nao deve entrar no frontend nem no Git. Ele deve ser guardado como variavel de ambiente no backend, por exemplo:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON={...}
```

Modelo recomendado de pastas:

```text
Casos de Clientes
└── Cliente
    └── Paciente - AAAA-MM-DD
        ├── 01 Fotos do antes
        ├── 02 Video panoramico do antes
        └── ...
```
