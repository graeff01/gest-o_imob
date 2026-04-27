# Sprint: PRD Readiness

Data: 2026-04-27
Branch: `codex/sprint-prd-readiness`

## Objetivo

Preparar a base do sistema para homologacao/PRD com separacao clara de perfis, diagnostico tecnico e validacao automatica em PR.

## Entregue

- Suporte a 1 perfil tecnico `ADMIN_MASTER` e ate 2 perfis operacionais `DONO` via variaveis de ambiente.
- Bloqueio server-side para telas tecnicas: `/saude`, `/auditoria`, `/configuracoes` e `/caixa-entrada`.
- API tecnica `/api/system/health` restrita ao `ADMIN_MASTER`.
- Diagnostico tecnico na tela de saude com ambiente, gateway, banco, usuarios ativos e notas pendentes.
- Checklist de readiness em `docs/prd-readiness.md`.
- Workflow GitHub Actions para validar PRs na `main`.
- Scripts `typecheck`, `lint:ci` e `verify:ci`.

## Validacao

- `npm run typecheck`
- `npx eslint` nos arquivos criticos da sprint
- `npm run build`
- `npm run verify:ci`

## Observacoes

- O lint completo do repositorio ainda possui dividas legadas em telas antigas. Por isso, o CI inicial valida TypeScript, build e lint dos modulos criticos endurecidos.
- O aviso de deprecated `middleware` do Next continua como debito tecnico futuro para migracao para `proxy`.
