# HML - Validacao de NFS-e

Este documento define o que significa dizer que o fluxo de NFS-e esta validado em homologacao.

## Objetivo

Validar o processo completo de NFS-e antes de qualquer uso em PRD:

1. importar arquivo DW;
2. revisar notas pendentes;
3. emitir NFS-e pela NFE.io em ambiente de teste;
4. receber status de emissao;
5. disponibilizar PDF/XML;
6. preparar envio ao cliente;
7. tratar duplicidades;
8. tratar erros;
9. registrar historico operacional.

## Escopo atual

Incluido:

- importacao DW;
- limpeza de importacoes pendentes;
- emissao NFE.io em HML;
- sincronizacao manual e automatica via webhook;
- download de PDF/XML;
- bloqueio operacional de duplicidade;
- marcacao manual de envio ao cliente;
- marcacao manual de pagamento/conciliacao;
- historico visual da nota.

Fora do escopo atual:

- envio automatico por WhatsApp;
- envio automatico por e-mail;
- conciliacao bancaria automatica;
- regras contabeis definitivas;
- deploy PRD.

## Fluxo validado

### 1. Importacao DW

Entrada esperada:

- arquivo `.csv`, `.xlsx` ou `.xls` exportado do DW;
- limite maximo de upload conforme definido pelo sistema;
- colunas e formato compativeis com o parser atual.

Resultado esperado:

- sistema mostra preview;
- duplicatas sao identificadas;
- somente registros validos sao gravados;
- erros aparecem com mensagem objetiva.

### 2. Revisao de nota pendente

Antes de emitir, o usuario deve conseguir identificar:

- cliente/tomador;
- CPF/CNPJ mascarado;
- competencia;
- valor;
- servico;
- descricao que sera enviada ao gateway;
- status atual;
- historico da nota.

### 3. Emissao

Resultado esperado em HML:

- sistema envia a nota para NFE.io em ambiente de teste;
- nota emitida aparece como emitida pela prefeitura de teste;
- historico registra tentativa e resultado;
- numero oficial aparece quando retornado pelo gateway.

### 4. Documentos

Depois de emitida, o sistema deve disponibilizar:

- PDF;
- XML, quando retornado pela NFE.io;
- acao visual clara para baixar os documentos.

### 5. Envio ao cliente

Hoje o envio e operacional/manual.

Resultado esperado:

- sistema prepara o envio;
- usuario baixa ou abre o PDF;
- usuario envia pelo canal combinado;
- usuario marca a nota como enviada.

### 6. Pagamento/conciliacao

Hoje a marcacao de pagamento e manual.

Isso e correto enquanto nao houver conciliacao bancaria automatica.
O status pago significa que o financeiro confirmou recebimento por extrato, banco ou rotina externa.

## Criterios de aceite de HML

HML pode ser considerado aprovado quando:

- login Admin Master funciona;
- usuario correto acessa NFS-e;
- importacao DW funciona com arquivo real;
- reimportacao do mesmo arquivo nao cria duplicidade indevida;
- emissao em HML funciona;
- erro da NFE.io aparece de forma compreensivel;
- PDF da nota emitida pode ser baixado pelo sistema;
- XML fica disponivel quando a NFE.io retorna;
- webhook da NFE.io atualiza a nota ou sincronizacao manual resolve;
- botao de envio ao cliente organiza a etapa operacional;
- marcacao manual de pago funciona;
- limpeza de pendentes nao apaga notas emitidas;
- nenhuma acao de HML usa gateway/empresa de PRD.

## Pendencias antes de PRD

- confirmar aliquota com contador;
- confirmar codigo de servico;
- confirmar inscricao municipal;
- confirmar regime tributario;
- confirmar dados cadastrais da empresa emissora;
- revisar variaveis PRD;
- revisar vulnerabilidades de dependencias;
- definir rollback PRD;
- executar validacao final em HML com cliente.
