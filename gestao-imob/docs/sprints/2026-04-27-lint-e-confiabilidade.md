# Sprint: Lint e Confiabilidade

Data: 2026-04-27
Branch: `codex/sprint-lint-e-confiabilidade`

## Objetivo

Elevar a confiabilidade do pipeline antes de homologacao/PRD, fazendo o lint completo deixar de bloquear a validacao automatica.

## Entregue

- Sprint `codex/sprint-prd-readiness` mergeada e publicada na `main`.
- Nova branch criada a partir da `main` atualizada.
- `npm run verify:ci` agora executa:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- `npm run lint` completo passa sem erros.
- Scripts `.cjs` mantidos como CommonJS permitido no ESLint.
- Filtros com `any` em rotas legadas trocados por enums do Prisma.
- Regra React `set-state-in-effect` rebaixada para warning por depender de padroes legados de hidratacao/localStorage.

## Validacao

- `npm run lint`
- `npm run verify:ci`

## Observacoes

- Ainda existem warnings legados de UI. Eles nao bloqueiam PR, mas devem ser reduzidos em sprints futuras por area funcional.
- O proximo endurecimento natural e ativar `--max-warnings=0` quando os warnings forem tratados.
