# Portal de Casos de Clientes - Design

## Objetivo

Transformar a base atual do app de aprovacao de criativos em um portal simples para dentistas cadastrarem casos de pacientes, enquanto o Monday continua sendo o backoffice central da equipe.

O dentista nao precisa acessar o Monday nem fazer login. Cada cliente recebe um link publico exclusivo. Ao abrir o link, ele ve seus pacientes, cadastra novos casos e envia arquivos por etapa.

## Estrutura no Monday

O Monday tera um board central para todos os clientes.

Cada paciente sera um item principal. Tudo sobre o paciente sera organizado em subitens.

### Item principal: paciente/caso

Colunas recomendadas:

- `Cliente`: dentista/clinica vinculado automaticamente pelo link.
- `Nome do paciente`: nome informado no app, tambem usado como nome do item.
- `Idade`: numero.
- `Genero`: dropdown/status com opcoes fixas.
- `Procedimento`: dropdown/status com opcoes fixas.
- `Descricao do procedimento`: texto livre.
- `Observacoes do caso`: texto livre.
- `Data de cadastro`: data criada automaticamente.
- `Progresso do caso`: opcional, pode ser calculado no app ou salvo futuramente.

### Opcoes iniciais de genero

- `Feminino`
- `Masculino`
- `Outro`
- `Prefere nao informar`

### Opcoes iniciais de procedimento

- `Lentes / Facetas`
- `Clareamento`
- `Implante`
- `Protese`
- `Ortodontia`
- `Harmonizacao`
- `Reabilitacao oral`
- `Cirurgia`
- `Outro`

### Subitens criados automaticamente

Ao criar um paciente, o app cria estes 10 subitens com status inicial `Fazer`:

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

Cada subitem tera:

- `Situacao da tarefa`: `Fazer` ou `Capturado`.
- `Arquivos`: coluna de arquivos usada para uploads.

Quando o cliente envia arquivos em uma etapa, o app sobe os arquivos para o subitem correto e muda `Situacao da tarefa` para `Capturado`.

## Link publico do cliente

Cada cliente tera um link exclusivo, por exemplo:

`/#/casos/<token-do-cliente>`

O token identifica o cliente e permite:

- carregar apenas os pacientes daquele cliente;
- preencher a coluna `Cliente` automaticamente;
- impedir que o dentista precise escolher cliente no formulario;
- manter o Monday escondido do usuario final.

Como nao havera login, o token deve ser dificil de adivinhar. Ele nao substitui seguranca forte, mas atende ao fluxo desejado de link privado compartilhado diretamente com cada cliente.

## Tela inicial do cliente

A tela inicial e um painel de pacientes em cards.

Funcionalidades:

- criar novo paciente;
- pesquisar por nome do paciente;
- filtrar por mes de cadastro;
- filtrar por status geral: `Em andamento`, `Completo`, `Com pendencias`;
- filtrar por genero;
- filtrar por faixa de idade;
- filtrar por procedimento;
- listar cards com:
  - nome do paciente;
  - data de cadastro;
  - idade e genero;
  - procedimento;
  - progresso, por exemplo `2/10 etapas capturadas`;
  - ultima atualizacao quando disponivel.

## Cadastro de paciente

O formulario de novo paciente pede:

- nome do paciente;
- idade;
- genero;
- procedimento;
- descricao do procedimento;
- observacoes gerais opcionais.

Ao enviar:

1. O app cria o item principal no Monday.
2. O app preenche as colunas do paciente.
3. O app cria os 10 subitens padrao.
4. O app retorna para a tela inicial com o paciente em card.

## Tela do paciente

Ao clicar em um paciente, o usuario entra na tela de etapas.

A tela mostra 10 cards, um por etapa. Cada card indica:

- nome da etapa;
- status `Fazer` ou `Capturado`;
- se existem arquivos;
- contador e/ou miniaturas de arquivos;
- acao para enviar arquivos.

Ao enviar arquivos:

1. O app faz upload para a coluna `Arquivos` do subitem.
2. O app muda o status do subitem para `Capturado`.
3. O app atualiza o progresso visual do paciente.

## Reaproveitamento da base atual

Pontos ja existentes e reutilizaveis:

- proxy Monday em `api/monday.ts`;
- wrapper GraphQL e upload em `services/mondayService.ts`;
- leitura de boards, colunas e subitens;
- criacao de item com `createItem`;
- upload de arquivo em subitem com `uploadFileToItem`;
- atualizacao de status com `updateItemStatus`;
- cadastro de clientes no Supabase em `services/supabaseService.ts`;
- estrutura React/Vite existente.

Pontos que precisam ser criados ou adaptados:

- modelo de dados de caso/paciente;
- funcoes Monday para criar subitens;
- funcoes Monday para montar `column_values` por tipo de coluna;
- portal publico por token;
- tela de lista de pacientes;
- formulario de cadastro;
- tela de etapas do paciente;
- filtros e busca;
- gerador de link de cliente ajustado ao novo portal.

## Decisoes de produto

- O Monday e a fonte principal de dados operacionais.
- O Supabase pode continuar guardando clientes e metadados do link.
- O dentista nao faz login.
- O paciente e o item principal.
- Os arquivos e tarefas do caso vivem nos subitens.
- Genero e procedimento devem ser opcoes controladas para evitar variacoes de texto que prejudiquem filtros e relatorios.

