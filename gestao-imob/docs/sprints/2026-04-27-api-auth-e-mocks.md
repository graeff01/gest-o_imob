# Sprint 2026-04-27 - API, Auth e Mocks

## Objetivo

Fechar lacunas que poderiam mascarar erro real em homologacao/producao e preparar o sistema para evoluir sem depender de dados mockados.

## Escopo

- Bloquear fallback mock fora do ambiente local explicitamente liberado.
- Proteger endpoints de exemplo para uso local.
- Migrar `middleware.ts` para `proxy.ts`.
- Expor configuracao tecnica da empresa emissora por API restrita ao `ADMIN_MASTER`.
- Criar endpoint controlado para limpeza de notas DW pendentes.
- Documentar checklist manual de validacao.
- Melhorar operacao de NFS-e com erro claro, painel de situacao por nota e historico visual.
- Preparar a tela de emissao para encaixe operacional do NFS.io em HML/PRD.
- Estruturar configuracao fiscal da empresa emissora em tela somente leitura para Admin Master.
- Adicionar checklist manual de PRD e revisao tecnica de seguranca dentro de `/saude`.
- Melhorar leitura operacional da auditoria para eventos sensiveis.
- Remover endpoints e links de arquivos de exemplo de DW/extrato do produto.

## Fora do escopo

- Banco Railway.
- Gateway NFS.io real.
- Ambientes HML/PRD no Railway.
- Tela visual completa de configuracao da empresa emissora.
- Testes automatizados, por decisao do projeto.

## Validacao

- Executar `npm run verify:ci`.
- Seguir `docs/checklist-validacao-manual.md`.
