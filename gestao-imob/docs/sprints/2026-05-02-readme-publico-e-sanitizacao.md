# Sprint - README publico e sanitizacao

Data: 2026-05-02

Branch: `codex/hml-nfse-validacao-operacional`

## Objetivo

Preparar o repositorio para apresentacao publica, com README voltado para portfolio/entrevista e reducao de exposicao de dados operacionais.

## Entregas

- README principal reescrito como apresentacao do produto.
- Guia de publicacao segura criado em `docs/publicacao-repositorio.md`.
- `.env.example` sanitizado com valores genericos.
- Scripts utilitarios locais removidos do versionamento.
- Dados demonstrativos com aparencia real substituidos por exemplos ficticios.
- Comentarios e textos com nomes operacionais/clientes removidos ou generalizados.
- Seed de admin alterado para exigir variaveis explicitas, sem senha padrao hardcoded.

## Validacoes executadas

- Busca por nomes operacionais, dominios, e-mails reais e URLs de HML/PRD.
- Busca por padroes de segredo em arquivos versionados.
- Busca por CPF/CNPJ com aparencia real.

## Observacao importante

Antes de tornar o repositorio publico, ainda e recomendado executar scanner de segredos no historico Git e rotacionar qualquer chave que ja tenha aparecido em prints, conversas ou commits antigos.
