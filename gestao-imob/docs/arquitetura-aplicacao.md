# Arquitetura da Aplicacao

## Objetivo

Padronizar a arquitetura do sistema para que cada modulo siga a mesma estrutura:

- `route.ts`: transporte HTTP
- `schema`: validacao de entrada
- `service`: regra de negocio e acesso a dados
- `authz`: permissao por perfil
- `audit`: rastreabilidade de eventos relevantes

## Camadas

### 1. Interface

Local: `src/app/(dashboard)`

Responsabilidades:

- renderizar telas
- chamar APIs
- exibir estados operacionais
- nao concentrar regra fiscal, financeira ou de permissao

### 2. API

Local: `src/app/api`

Responsabilidades:

- validar entrada
- autenticar e autorizar
- delegar para services
- responder com contrato padronizado

Padrao novo:

- `apiSuccess`
- `apiCreated`
- `apiList`
- `handleApiError`

### 3. Services

Local: `src/server`

Responsabilidades:

- montar filtros
- criar registros
- centralizar relacoes entre tabelas
- acionar auditoria
- concentrar regras de negocio

Services principais desta sprint:

- `people-service.ts`
- `property-service.ts`
- `contract-service.ts`
- `financial-service.ts`
- `operations-service.ts`
- `invoice-service.ts`

### 4. Persistencia

Local: `prisma/schema.prisma`

Responsabilidades:

- estrutura de dados
- relacionamentos
- unicidade
- indices

## Perfis

Perfis ativos:

- `ADMIN_MASTER`
- `DONO`

Regras:

- `ADMIN_MASTER`: configuracao, auditoria, saude, release, operacao completa
- `DONO`: operacao, consulta, emissao, acompanhamento

Blindagem aplicada:

- menu por perfil
- rotas tecnicas protegidas em layout
- APIs elevadas protegidas com `requireElevatedRole`
- APIs tecnicas protegidas com `requireTechnicalRole`

## Auditoria

Todo evento relevante deve gerar rastro:

- criacao de cadastro
- criacao de contrato
- criacao de receita/despesa
- criacao de campanha
- registro de documento
- eventos fiscais
- alteracao de parametros

Helper comum:

- `src/server/crud-audit.ts`

## Politica de mocks

Fallback mock nao deve mascarar ambiente quebrado em homologacao/producao.

Diretriz:

- se o banco falhar, retornar erro controlado
- mock somente quando explicitamente habilitado
- tela deve reagir com mensagem operacional, nao com dado falso

## Proxima etapa recomendada

Depois desta sprint:

1. levar o mesmo padrao para fornecedores, funcionarios, folha e comissoes
2. revisar endpoints antigos restantes
3. fechar integracoes de extratos e conciliacao no mesmo modelo
4. revisar constraints e indices antes do banco definitivo em PRD
