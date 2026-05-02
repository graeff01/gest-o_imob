# Runbook - NFS-e em HML

Este runbook orienta operacao e diagnostico do fluxo de NFS-e no ambiente de homologacao.

## URL

A URL de HML deve ser consultada no Railway ou no gestor do projeto.

Nao registrar dominios operacionais reais em documentacao publica.

## Pre-condicoes

Antes de testar:

- HML deve estar com deploy ativo;
- banco HML deve estar separado de PRD;
- `APP_ENV` deve indicar homologacao;
- NFE.io deve estar em ambiente de teste;
- certificado deve estar cadastrado na empresa de teste;
- webhook da NFE.io deve apontar para HML;
- usuario Admin Master de HML deve estar ativo.

## Validar variaveis no Railway

Com CLI:

```powershell
railway status
railway variables
```

Conferir sem expor valores secretos:

```text
APP_ENV=homolog
NEXT_PUBLIC_APP_ENV=homologacao
GATEWAY_STUB_MODE=false
NFSE_HOMOLOGACAO=true
NFSE_GATEWAY_PROVIDER=nfeio
ALLOW_MOCK_FALLBACKS=false
```

## Fluxo operacional

### 1. Entrar no sistema

1. Acessar HML.
2. Fazer login com usuario autorizado.
3. Confirmar aviso visual de HML.

### 2. Preparar base de teste

1. Acessar Notas Fiscais.
2. Se necessario, limpar pendencias DW.
3. Importar arquivo DW.
4. Confirmar preview.
5. Gravar importacao.

Resultado esperado:

- notas aparecem como pendentes;
- valores e competencias fazem sentido;
- nao ha duplicidade indevida.

### 3. Emitir uma nota

1. Escolher uma nota pendente.
2. Abrir detalhes.
3. Conferir cliente, valor, competencia e descricao.
4. Confirmar emissao.

Resultado esperado:

- nota muda para processando ou emitida;
- historico registra tentativa;
- gateway fica registrado como `nfeio`.

### 4. Sincronizar resultado

Preferencial:

- aguardar webhook atualizar automaticamente.

Alternativa:

- clicar em sincronizar NFE.io.

Resultado esperado:

- status final fica claro;
- se emitida, aparece numero oficial;
- PDF/XML aparecem quando disponiveis.

### 5. Baixar documentos

1. Na nota emitida, baixar PDF.
2. Baixar XML se disponivel.

Resultado esperado:

- PDF abre corretamente;
- XML baixa corretamente;
- links nao expõem chave secreta do gateway.

### 6. Envio ao cliente

1. Clicar em preparar envio ao cliente.
2. Abrir PDF ou mensagem preparada.
3. Enviar manualmente pelo canal combinado.
4. Marcar como enviada.

Resultado esperado:

- status operacional indica envio ao cliente.

### 7. Pagamento

Pagamento deve ser marcado manualmente apenas quando o financeiro confirmar recebimento.

Nao marcar como paga apenas porque a nota foi emitida.

## Diagnostico de erros comuns

### Erro 401 da NFE.io

Possiveis causas:

- `NFSE_GATEWAY_API_KEY` incorreta;
- chave de teste/producao trocada;
- permissao da empresa ausente;
- `NFSE_COMPANY_ID` errado.

Acao:

- revisar variaveis no Railway;
- confirmar empresa no painel NFE.io;
- testar novamente em HML.

### Erro 400 da NFE.io

Possiveis causas:

- dados fiscais incompletos;
- codigo de servico invalido;
- aliquota incorreta;
- cidade/servico nao integrado;
- tomador com CPF/CNPJ/endereco invalido.

Acao:

- abrir detalhe tecnico da nota;
- comparar payload esperado com dados da empresa;
- corrigir dados no sistema ou NFE.io;
- reenviar apenas depois de entender a causa.

### PDF/XML nao aparecem

Possiveis causas:

- gateway ainda nao terminou processamento;
- webhook nao chegou;
- sincronizacao ainda nao foi feita;
- NFE.io nao retornou documento.

Acao:

- clicar em sincronizar NFE.io;
- consultar painel NFE.io;
- verificar logs do Railway;
- validar endpoint de webhook.

### Nota duplicada

Possiveis causas:

- mesmo arquivo DW importado mais de uma vez;
- mesma receita emitida por outro registro;
- competencia/valor/cliente iguais.

Acao:

- revisar notas existentes;
- emitir duplicada somente com confirmacao consciente;
- registrar motivo operacional se necessario.

## Logs

Com CLI:

```powershell
railway logs
```

Para build:

```powershell
railway logs --build --lines 200 <deployment_id>
```

Para deploy:

```powershell
railway logs --deployment <deployment_id>
```

## Quando escalar

Escalar para investigacao tecnica quando:

- emissao falha para todas as notas;
- webhook parou de atualizar;
- PDF/XML nao aparecem mesmo emitidos na NFE.io;
- usuario consegue acao fora da permissao;
- HML aparenta usar dado ou gateway de PRD.
