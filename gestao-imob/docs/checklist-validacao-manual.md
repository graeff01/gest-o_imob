# Checklist de Validacao Manual

Use este checklist antes de mergear uma sprint para `main` e antes de liberar uma versao para homologacao.

## Acesso

- Login com `ADMIN_MASTER` funciona.
- Login com cada usuario `DONO` funciona.
- Usuario `DONO` nao acessa `/saude`, `/auditoria`, `/configuracoes` e `/caixa-entrada`.
- Usuario sem sessao e redirecionado para `/login`.
- APIs protegidas retornam `401` sem sessao.

## Notas fiscais

- Importacao DW gera preview antes de gravar.
- Confirmacao da importacao DW grava apenas linhas novas.
- Reenvio do mesmo arquivo DW marca duplicatas.
- Limpeza DW via API remove apenas notas `PENDENTE` importadas do DW.
- Nota emitida, cancelada ou com erro nao e removida pela limpeza DW.
- Emissao em modo stub funciona no local/homologacao.
- Cancelamento de nota registra auditoria e atualiza status.

## Segurança local antes de PRD

- `ALLOW_MOCK_FALLBACKS=false` fora do local.
- `GATEWAY_STUB_MODE=false` em producao.
- `/saude` nao exibe segredo, senha, token ou URL sensivel completa.
- Endpoints de exemplo retornam 404 fora do ambiente local.
- OCR sem `OPENAI_API_KEY` so usa mock quando fallback local estiver explicitamente liberado.

## Operacao

- `/saude` mostra ambiente correto.
- `/auditoria` mostra eventos recentes relevantes.
- `npm run verify:ci` passa antes da PR.
- Arquivos `.env`, `.env.local`, logs e temporarios nao entram no commit.
- PR descreve o que mudou, como validar e quais riscos continuam.
