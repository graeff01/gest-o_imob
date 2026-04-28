# Sprint 2026-04-27 - Telas sem mock e permissoes

## Objetivo

Reduzir risco operacional antes de PRD removendo telas que pareciam operar com dados reais, mas ainda dependiam de dados demonstrativos ou armazenamento local.

## Entregas

- Financeiro sem valores demonstrativos.
- Contratos sem lista demonstrativa.
- Proprietarios legado sem gravacao local.
- Pessoas, Imoveis e Campanhas com erro claro quando o banco estiver indisponivel.
- Documentos sem mensagem de sucesso que pareca persistencia real quando a rota rejeita o lancamento.
- Release Atual protegido por layout exclusivo de Admin Master.
- Busca global inclui Release Atual apenas para Admin Master.
- `.env` e `.env.local` confirmados fora do git; `.env.example` revisado para nao orientar uso de mock.

## Validacao

- `npm run verify:ci`
