# Sprint: Homolog/PRD Hardening

Data: 2026-04-27
Branch: `codex/sprint-homolog-prd-hardening`

## Objetivo

Avancar a preparacao para homologacao e producao sem implementar testes automatizados.

## Entregue

- Sprint `codex/sprint-lint-e-confiabilidade` mergeada e publicada na `main`.
- Nova branch criada a partir da `main` atualizada.
- Validacao de ambiente reforcada para homologacao/producao:
  - `DATABASE_URL` obrigatorio fora do local.
  - `AUTH_ADMIN_EMAIL` e `AUTH_ADMIN_HASH` obrigatorios fora do local.
  - `AUTH_OWNER_1_EMAIL` e `AUTH_OWNER_1_HASH` obrigatorios fora do local.
  - `AUTH_OWNER_2_EMAIL` e `AUTH_OWNER_2_HASH` obrigatorios fora do local.
  - `AUTH_URL` deve usar `https://` em production.
- Checklist de PRD atualizado com `AUTH_URL` e regra de HTTPS.
- Tela de login redesenhada com aparencia mais corporativa e sem credenciais expostas.
- Campos de login com `autocomplete` adequado para email e senha.
- Headers basicos de seguranca adicionados no Next:
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- `verify:ci` validado apos as mudancas.

## Validacao

- `npm run verify:ci`

## Observacoes

- Testes automatizados ficaram fora desta sprint por decisao do usuario.
- O proximo passo recomendado e preparar as variaveis reais de homologacao no Railway e validar o fluxo com banco separado.
