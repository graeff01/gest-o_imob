# Backlog Pos-PRD

Itens que nao bloqueiam a preparacao atual, mas devem ser tratados conforme o sistema evoluir.

## Infraestrutura futura

- Assinar e configurar NFS.io.
- Criar Railway HML.
- Criar Railway PRD.
- Criar banco HML.
- Criar banco PRD.
- Configurar dominio e HTTPS.
- Configurar backup automatico do banco.

## Produto

- Tela de usuarios para ativar/desativar dono e trocar senha.
- Tela de configuracao da empresa emissora.
- Desfazer lote de importacao DW com auditoria.
- Historico detalhado de tentativas de emissao NFS-e.
- Exportacao fiscal/contabil padronizada.
- Tela de erros do gateway com orientacao operacional.

## Codigo

- Remover mocks/fallbacks legados das APIs antigas antes de PRD com cliente real.
- Migrar `middleware.ts` para `proxy`, conforme aviso do Next.
- Reduzir warnings do lint ate permitir `--max-warnings=0`.
- Centralizar autorizacao por perfil em todas as APIs legadas.
- Persistir auditoria em tabela propria no banco.

## Operacao

- Criar plano de backup/restore testado.
- Criar checklist de deploy HML.
- Criar checklist de deploy PRD.
- Criar rotina de release notes.
