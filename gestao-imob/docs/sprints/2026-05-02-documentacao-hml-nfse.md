# Sprint - Documentacao HML NFS-e

Data: 2026-05-02

Branch: `codex/hml-nfse-validacao-operacional`

## Objetivo

Estruturar documentacao de projeto para suportar validacao HML da NFS-e antes de qualquer promocao para PRD.

## Entregas

- README principal do projeto substituido por documentacao real do sistema.
- Indice de documentacao em `docs/README.md`.
- Politica de ambientes em `docs/ambientes-e-governanca.md`.
- Documento de validacao HML em `docs/hml-nfse-validacao.md`.
- Runbook operacional de NFS-e em HML em `docs/runbooks/nfse-hml.md`.
- ADR sobre validar HML antes de PRD.
- Template para registro de validacao HML.
- Referencias cruzadas adicionadas em processo de desenvolvimento e PRD readiness.

## Fora do escopo

- Criar tela dentro do sistema.
- Alterar fluxo de produto.
- Alterar variaveis Railway.
- Promover mudancas para PRD.

## Validacao

- `git diff --check` executado sem erros.
- Documentacao revisada para nao incluir segredos.

## Proximo passo

Usar `docs/templates/registro-validacao-hml.md` para registrar rodadas reais de validacao quando necessario.
