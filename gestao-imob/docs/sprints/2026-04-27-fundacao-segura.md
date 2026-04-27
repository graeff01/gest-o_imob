# Sprint: Fundacao Segura

## Objetivo

Transformar o modulo de notas fiscais de prototipo para base operacional mais segura, sem depender ainda de Railway, banco definitivo ou gateway real.

## Entregue

- Middleware global reativado.
- APIs de notas protegidas por sessao.
- `created_by` passou a vir do usuario autenticado.
- Fallback silencioso para memoria removido das rotas de invoices.
- Emissao passou a buscar e atualizar notas via Prisma.
- Validacoes Zod para criacao, filtros, atualizacao e emissao.
- Transicoes de status controladas no backend.
- Importacao DW usando Prisma e usuario autenticado.
- Login local alinhado para um unico usuario de teste.

## Observacao Git

O commit nao foi criado porque a pasta `.git` esta bloqueada pelo OneDrive/Windows (`index.lock: Permission denied`). Quando a permissao for corrigida, commitar estes arquivos como uma unidade.
