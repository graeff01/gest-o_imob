# Ambientes e Governanca

Este documento define como os ambientes devem ser usados e protegidos.

## Principio central

HML e o ambiente de validacao operacional.
PRD e o ambiente real.

Nenhuma mudanca deve ir para PRD apenas porque "funcionou localmente".
O caminho correto e:

1. desenvolvimento local;
2. branch de sprint;
3. validacao tecnica;
4. deploy em HML;
5. validacao operacional em HML;
6. aprovacao para PRD;
7. deploy controlado em PRD.

## Ambientes

| Ambiente | Uso | Dados | Gateway |
| --- | --- | --- | --- |
| Local | Desenvolvimento e ajustes rapidos | Dados locais/de teste | Stub ou sandbox |
| HML | Validacao com fluxo realista | Dados controlados de homologacao | NFE.io em teste |
| PRD | Operacao real | Dados reais | NFE.io em producao |

## Variaveis obrigatorias por ambiente

### HML

- `APP_ENV=homolog`
- `NEXT_PUBLIC_APP_ENV=homologacao`
- `ALLOW_MOCK_FALLBACKS=false`
- `GATEWAY_STUB_MODE=false`
- `NFSE_HOMOLOGACAO=true`
- `NFSE_GATEWAY_PROVIDER=nfeio`
- `NFSE_GATEWAY_API_KEY`
- `NFSE_COMPANY_ID`
- `NFSE_COMPANY_CNPJ`
- `DATABASE_URL`
- `AUTH_URL`
- `AUTH_SECRET`

### PRD

- `APP_ENV=production`
- `NEXT_PUBLIC_APP_ENV=production`
- `ALLOW_MOCK_FALLBACKS=false`
- `GATEWAY_STUB_MODE=false`
- `NFSE_HOMOLOGACAO=false`
- `NFSE_GATEWAY_PROVIDER=nfeio`
- `NFSE_GATEWAY_API_KEY` de producao
- `NFSE_COMPANY_ID` de producao
- `DATABASE_URL` de producao
- `AUTH_URL` de producao
- `AUTH_SECRET` de producao

## Regras de seguranca

- HML nunca deve usar empresa/gateway de producao.
- PRD nunca deve usar gateway de teste.
- HML e PRD devem ter bancos separados.
- Segredos nunca devem ser versionados.
- O `.env` local nao e fonte de verdade para Railway.
- Variaveis do Railway devem ser revisadas no painel/CLI antes de qualquer deploy importante.

## Politica de branch

- `main` representa codigo estavel.
- Toda melhoria deve nascer em branch `codex/...`.
- HML pode receber deploy de branch de validacao.
- PRD deve receber apenas codigo aprovado e mergeado.

## Promocao de HML para PRD

Uma versao so pode ser promovida quando:

- HML passou no fluxo de validacao de NFS-e;
- erros conhecidos estao documentados;
- dados fiscais foram conferidos;
- variaveis PRD foram revisadas;
- existe plano de rollback;
- usuario responsavel aprovou a liberacao.
