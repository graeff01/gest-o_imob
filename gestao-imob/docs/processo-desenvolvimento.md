# Processo de Desenvolvimento

Este e o fluxo oficial para reduzir risco antes de homologacao e producao.

## Branches

- `main`: sempre deve representar codigo estavel.
- `codex/sprint-*`: desenvolvimento de uma sprint ou melhoria especifica.

Nunca desenvolver diretamente na `main`.

## Fluxo

1. Atualizar a `main`.
2. Criar branch de sprint a partir da `main`.
3. Desenvolver e commitar em partes pequenas.
4. Rodar `npm run verify:ci`.
5. Abrir PR para `main`.
6. Revisar e validar funcionalmente.
7. Mergear apenas quando estiver estavel.
8. Atualizar a `main` local depois do merge.

## Criterio de pronto para merge

- `npm run verify:ci` passa.
- Funcionalidade validada manualmente no sistema.
- Nenhuma variavel sensivel entrou no Git.
- Documentacao atualizada quando houver mudanca de processo, ambiente, perfil ou regra fiscal.
- Risco de rollback entendido.

## Release

Antes de uma release para homologacao ou producao:

- registrar mudancas principais;
- confirmar banco correto;
- confirmar ambiente (`APP_ENV`);
- confirmar secrets corretos;
- validar login Admin Master;
- validar login Dono;
- validar importacao DW;
- validar fluxo NFS-e no modo adequado;
- conferir `/saude`.

## Rollback

Rollback deve voltar para o ultimo commit/tag estavel da `main`.

Em PRD, nunca corrigir diretamente em producao. O fluxo correto e:

1. Criar branch de hotfix.
2. Corrigir.
3. Rodar validacoes.
4. Mergear.
5. Deployar novamente.

## Responsabilidades

- Admin Master: valida saude do sistema, riscos, configuracoes e operacao tecnica.
- Donos: validam operacao diaria e emissao de notas.
- Mudancas fiscais/contabeis devem ter validacao operacional antes de PRD.
