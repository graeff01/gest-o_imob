# Sprint: Blindagem Local Antes de Homolog

## Objetivo

Reduzir erros cotidianos e preparar o sistema para homologacao/producao sem ainda depender de banco definitivo ou gateway real.

## Escopo

- Declarar ambiente (`APP_ENV`) e validar configuracoes perigosas.
- Esconder credenciais de demo fora do ambiente local.
- Melhorar validacao de arquivo DW.
- Mascarar CPF/CNPJ em listagens e previews.
- Estruturar auditoria abstrata para futura tabela persistente.
- Endurecer regras de nota fiscal para evitar estados inconsistentes.

## Politica de ambiente

- `local`: pode usar stub e credenciais visiveis.
- `homolog`: deve usar dados controlados e gateway sandbox.
- `production`: nao pode usar stub, segredo de preview ou credenciais expostas.
