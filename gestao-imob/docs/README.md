# Documentacao do Projeto

Este diretorio concentra a documentacao operacional e tecnica do sistema.

O objetivo e permitir que outra pessoa entre no projeto e entenda rapidamente:

- como o sistema esta organizado;
- qual ambiente deve ser usado para cada etapa;
- como validar o fluxo de NFS-e em homologacao;
- quais cuidados existem antes de qualquer movimento para PRD;
- como investigar problemas sem depender de memoria informal.

## Ordem recomendada de leitura

1. [Processo de desenvolvimento](./processo-desenvolvimento.md)
2. [Ambientes e governanca](./ambientes-e-governanca.md)
3. [HML - Validacao de NFS-e](./hml-nfse-validacao.md)
4. [Runbook NFS-e em HML](./runbooks/nfse-hml.md)
5. [PRD readiness](./prd-readiness.md)
6. [Backlog pos-PRD](./backlog-pos-prd.md)

## Documentos principais

| Documento | Uso |
| --- | --- |
| `processo-desenvolvimento.md` | Fluxo de branch, PR, merge e rollback. |
| `ambientes-e-governanca.md` | Separacao entre local, HML e PRD. |
| `hml-nfse-validacao.md` | Criterios para dizer que HML esta pronto. |
| `runbooks/nfse-hml.md` | Passo a passo para operar e diagnosticar NFS-e em HML. |
| `prd-readiness.md` | Requisitos minimos antes de PRD real. |
| `sprints/` | Historico das sprints tecnicas. |
| `decisoes/` | Decisoes arquiteturais e operacionais relevantes. |

## Regras de documentacao

- Nunca registrar senhas, tokens, API keys, hashes completos ou URLs privadas sensiveis.
- Documentar nomes de variaveis, nao os valores secretos.
- Toda mudanca em fluxo fiscal, ambiente, permissao ou gateway deve atualizar a documentacao.
- Toda sprint relevante deve ter resumo em `docs/sprints/`.
- Toda decisao que muda a forma de operar o sistema deve virar ADR em `docs/decisoes/`.

## Estado atual de foco

O foco atual do projeto e validar 100% o fluxo de NFS-e em HML antes de qualquer promocao para PRD.

PRD so deve ser considerado depois que:

- HML estiver validado operacionalmente;
- dados fiscais forem confirmados com cliente/contador;
- variaveis PRD estiverem revisadas;
- rollback estiver claro;
- riscos conhecidos estiverem documentados.
