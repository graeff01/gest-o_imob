# ADR-0001 - Validar HML antes de PRD

## Status

Aceita.

## Contexto

O sistema emite NFS-e por integracao com gateway externo.
Esse fluxo envolve dados fiscais, certificado, prefeitura, documentos oficiais e operacao financeira.

Qualquer erro em PRD pode gerar retrabalho operacional, emissao incorreta ou exposicao de dados.

## Decisao

O projeto deve validar 100% o fluxo de NFS-e em HML antes de qualquer promocao para PRD.

PRD nao sera usado como ambiente de teste.

## Consequencias

Positivas:

- reduz risco fiscal e operacional;
- permite testar NFE.io com mais seguranca;
- separa dados de teste de dados reais;
- cria trilha clara para futuras pessoas no projeto;
- facilita rollback e diagnostico.

Custos:

- exige manter variaveis separadas;
- exige validar cada mudanca em HML;
- exige disciplina de branch/PR/deploy.

## Regras derivadas

- HML usa `NFSE_HOMOLOGACAO=true`.
- PRD usa `NFSE_HOMOLOGACAO=false`.
- HML e PRD devem ter bancos separados.
- Segredos de HML e PRD devem ser diferentes.
- Toda mudanca de NFS-e deve ser testada em HML antes de PRD.
