# API e Permissoes

## Contrato de resposta

### Sucesso simples

```json
{
  "revenue": {
    "id": "..."
  }
}
```

### Criacao

Status `201`

```json
{
  "client": {
    "id": "..."
  }
}
```

### Listagem

```json
{
  "clients": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

### Erro padronizado

```json
{
  "error": "Mensagem para o operador",
  "code": "CODIGO_OPCIONAL",
  "details": []
}
```

## Regras de permissao

### `requireAuth`

Usar quando a rota for apenas autenticada.

Exemplos:

- listagens operacionais
- consultas
- dashboards

### `requireElevatedRole`

Usar quando a rota altera estado operacional.

Exemplos:

- criar cliente
- criar proprietario
- criar imovel
- criar contrato
- criar receita
- criar despesa
- emitir NFS-e

### `requireTechnicalRole`

Usar quando a rota for tecnica e exclusiva do Admin Master.

Exemplos:

- parametros
- saude
- release
- auditoria tecnica

## Rotas tecnicas blindadas

As seguintes paginas nao devem abrir para perfil `DONO`:

- `/saude`
- `/configuracoes`
- `/auditoria`
- `/release-atual`

Implementacao:

- `src/lib/route-access.ts`
- `src/components/layout/route-access-gate.tsx`

## Auditoria minima obrigatoria

Para qualquer rota de criacao/alteracao:

- quem executou
- qual entidade foi afetada
- qual acao ocorreu
- resumo operacional
- metadados sem dados sensiveis

## Regra operacional

Nenhuma rota deve:

- depender de estado mock silencioso
- retornar sucesso falso para criacao real
- gravar com `session.user.id` quando o banco exige `dbUserId`

Sempre preferir:

- `ctx.dbUserId`
- `handleApiError`
- `auditCrud`
