# PRD Readiness

Este documento define o minimo para considerar o sistema pronto para homologacao e producao.

## Perfis

- `ADMIN_MASTER`: perfil tecnico. Acessa saude do sistema, auditoria, configuracoes, riscos e diagnosticos.
- `DONO`: perfil operacional. Gerencia a rotina e emite notas fiscais, sem acesso a telas tecnicas.
- Em PRD, o esperado sao 3 usuarios ativos: 1 `ADMIN_MASTER` e 2 `DONO`.

## Ambientes

- `local`: desenvolvimento na maquina.
- `homolog`: validacao com banco e configuracoes proximas de PRD.
- `production`: ambiente real.

## Variaveis obrigatorias fora do local

- `APP_ENV`
- `NEXT_PUBLIC_APP_ENV`
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_ADMIN_EMAIL`
- `AUTH_ADMIN_HASH`
- `AUTH_OWNER_1_EMAIL`
- `AUTH_OWNER_1_HASH`
- `AUTH_OWNER_2_EMAIL`
- `AUTH_OWNER_2_HASH`

## NFS-e

Para gateway real:

- `GATEWAY_STUB_MODE=false`
- `NFSE_GATEWAY_API_KEY`
- `NFSE_COMPANY_ID`
- `NFSE_COMPANY_CNPJ`
- `NFSE_COMPANY_IM`

Em `production`, o sistema bloqueia `GATEWAY_STUB_MODE=true`.

## Antes de mergear uma sprint

- `npm run verify:ci`
- `npm run lint` completo deve executar sem erros
- testar login Admin Master
- testar login Dono
- testar importacao DW com arquivo real
- testar emissao/cancelamento de nota em modo stub ou homologacao
- conferir `/saude` com Admin Master
- confirmar que Dono nao acessa `/saude`, `/auditoria`, `/configuracoes` e `/caixa-entrada`

## Antes de PRD

- banco Railway criado e com backup habilitado
- ambiente de homologacao criado
- secrets separados para homologacao e production
- gateway NFS-e homologado
- dominio configurado
- rotina de rollback definida
- CI ativo em toda PR para `main`
