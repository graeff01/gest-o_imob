# Sprint: trava de liberacao PRD NFS-e

## Objetivo

Deixar o ambiente de production apto a subir com banco, usuarios e gateway preparados, mas bloquear emissao real de NFS-e ate confirmacao final dos dados fiscais.

## Entregas

- Variavel `NFSE_PRD_READY` controla a liberacao final da emissao em production.
- Backend bloqueia qualquer emissao de NFS-e em PRD quando a liberacao esta pendente.
- Tela de notas fiscais mostra aviso operacional e desabilita emissao quando PRD esta bloqueado.
- Configuracao fiscal exposta com seguranca para usuarios operacionais autenticados, sem retornar segredos.
- `.env.example` e `docs/prd-readiness.md` documentam o fluxo.

## Criterio de liberacao

`NFSE_PRD_READY=true` so deve ser usado depois de confirmar:

- API key e Company ID corretos no NFS.io.
- CNPJ e inscricao municipal da empresa emissora.
- Cidade/ambiente corretos no gateway.
- Codigo nacional, codigo municipal complementar e aliquota validados com cliente/contador.
- Teste completo em HML com emissao, PDF/XML e retorno do webhook.
