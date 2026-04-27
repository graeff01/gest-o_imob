# Sprint 2026-04-27 - Release e remocao de dados demonstrativos

## Objetivo

Preparar o sistema local para uma leitura mais proxima de PRD, reduzindo risco de cliente enxergar dados falsos como dados reais.

## Entregas

- Botao visual para limpar importacoes DW pendentes na tela de notas fiscais.
- Tela "Release atual" para Admin Master com versao, branch, PR e checklist.
- Dashboard, relatorios, comissoes e DIMOB sem indicadores demonstrativos.
- Configuracao fiscal da empresa editavel para Admin Master como rascunho local.
- Fallback mock global desativado, mesmo em ambiente local.

## Fora desta sprint

- Banco real Railway.
- Ambiente HML.
- Integracao NFS.io homologacao/producao.
- Persistencia definitiva dos dados fiscais da empresa.

## Validacao

- `npm run verify:ci`
