# Gestao Imob

Sistema interno de gestao financeira, operacional e fiscal para operacao imobiliaria.

O foco atual do projeto e validar o fluxo de NFS-e em HML antes de qualquer promocao para PRD.

## Stack

- Next.js
- TypeScript
- Prisma
- PostgreSQL
- Railway
- NFE.io para NFS-e

## Documentacao

A documentacao principal fica em [`docs/`](./docs/README.md).

Leitura recomendada:

1. [`docs/processo-desenvolvimento.md`](./docs/processo-desenvolvimento.md)
2. [`docs/ambientes-e-governanca.md`](./docs/ambientes-e-governanca.md)
3. [`docs/hml-nfse-validacao.md`](./docs/hml-nfse-validacao.md)
4. [`docs/runbooks/nfse-hml.md`](./docs/runbooks/nfse-hml.md)
5. [`docs/prd-readiness.md`](./docs/prd-readiness.md)

## Ambientes

| Ambiente | Objetivo |
| --- | --- |
| Local | Desenvolvimento e ajustes tecnicos. |
| HML | Validacao operacional com fluxo realista. |
| PRD | Operacao real, somente apos aprovacao de HML. |

## Desenvolvimento local

Instalar dependencias:

```powershell
npm install
```

Gerar Prisma Client:

```powershell
npm run prisma:generate
```

Rodar local:

```powershell
npm run dev
```

Validar antes de commit/PR:

```powershell
npm run typecheck
npm run lint
npm run build
```

Quando aplicavel:

```powershell
npm run verify:ci
```

## Regras importantes

- Nao desenvolver direto na `main`.
- Usar branch `codex/...` para sprints e melhorias.
- Nao versionar `.env`, `.env.local`, tokens, API keys ou senhas.
- HML deve usar gateway NFE.io em teste.
- PRD nao deve ser usado para teste de fluxo fiscal.
- Mudancas de NFS-e precisam ser validadas em HML antes de PRD.

## NFS-e

O fluxo de NFS-e cobre:

- importacao DW;
- revisao de notas pendentes;
- emissao pela NFE.io;
- sincronizacao de status;
- PDF/XML;
- envio operacional ao cliente;
- controle manual de pagamento/conciliacao;
- historico visual e auditoria.

Detalhes operacionais:

- [`docs/hml-nfse-validacao.md`](./docs/hml-nfse-validacao.md)
- [`docs/runbooks/nfse-hml.md`](./docs/runbooks/nfse-hml.md)

## Seguranca

- Segredos ficam no ambiente, nunca no Git.
- Bancos de HML e PRD devem ser separados.
- HML e PRD devem ter variaveis diferentes.
- `ALLOW_MOCK_FALLBACKS=false` fora do local.
- `GATEWAY_STUB_MODE=false` quando usando gateway real.

## Status atual

HML e o ambiente prioritario.

PRD sera tratado somente depois que:

- HML estiver validado;
- dados fiscais forem confirmados;
- contador/cliente aprovarem regras fiscais;
- variaveis PRD forem revisadas;
- rollback estiver definido.
