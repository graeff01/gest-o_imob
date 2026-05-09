# Fluxos Operacionais Entre Modulos

## 1. Cadastro base

Ordem recomendada:

1. proprietario
2. cliente
3. imovel
4. contrato

Motivo:

- contrato depende de cliente e imovel
- imovel depende de proprietario

## 2. Financeiro

### Receita

Pode nascer de:

- contrato
- operacao manual
- campanha
- royalty

### Despesa

Deve sair com:

- categoria
- departamento
- vencimento/status
- rastreio de criacao

## 3. Extratos e conciliacao

Fluxo alvo:

1. importar extrato
2. aplicar regra de classificacao
3. revisar pendencias
4. conciliar com receita/despesa/royalty
5. registrar auditoria

## 4. NFS-e

Fluxo atual:

1. importar DW
2. revisar nota
3. emitir
4. sincronizar gateway
5. baixar PDF/XML
6. marcar enviada
7. marcar paga

## 5. Campanhas

Fluxo alvo:

1. criar campanha
2. vincular entradas elegiveis
3. aprovar
4. pagar
5. refletir em operacao/folha quando aplicavel

## 6. Documentos

Fluxo alvo:

1. registrar documento
2. vincular entidade relacionada
3. marcar processamento
4. revisar
5. consultar historico

## 7. Riscos que esta sprint reduz

- criacoes sem trilha de auditoria
- POSTs usando id errado de usuario
- diferenca de resposta entre APIs
- pagina tecnica aberta por URL para dono
- regra de negocio duplicada ou perdida em rota

## 8. Proxima consolidacao

Levar o mesmo padrao para:

- fornecedores
- funcionarios
- comissoes
- folha
- relatorios analiticos
