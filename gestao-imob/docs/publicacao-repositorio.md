# Publicacao Segura do Repositorio

Este documento define o minimo necessario antes de tornar o repositorio publico.

## Regra principal

O repositorio publico pode mostrar o produto, arquitetura e qualidade tecnica.
Ele nao pode expor dados reais, credenciais, operacao do cliente, URLs privadas ou historico sensivel.

## Antes de abrir o repositorio

### 1. Segredos

Confirmar que nao existem arquivos versionados com:

- `.env`
- `.env.local`
- certificado `.pfx`
- arquivo `.pem`
- token de API
- senha
- hash real de usuario
- URL completa de banco

Comandos uteis:

```powershell
git ls-files
git log --all --oneline -- .env .env.local
git grep -n -I -E "DATABASE_URL|AUTH_SECRET|API_KEY|TOKEN|PASSWORD|SENHA|postgresql://"
```

### 2. Historico Git

Mesmo que o arquivo tenha sido removido agora, ele pode continuar no historico.

Se algum segredo ja entrou em commit:

1. rotacionar o segredo no provedor;
2. invalidar a chave antiga;
3. remover do historico com ferramenta propria;
4. forcar push somente depois de entender o impacto.

Sem rotacao, apenas apagar o arquivo nao resolve.

### 3. Dados reais

Remover ou anonimizar:

- nomes de clientes;
- CPFs/CNPJs reais;
- e-mails reais;
- telefones reais;
- enderecos reais;
- nomes de empresas operacionais;
- URLs de HML/PRD;
- planilhas, PDFs e exports reais.

### 4. Ambientes

O README publico nao deve ensinar acesso a HML/PRD.

Documentacao publica pode explicar arquitetura e governanca, mas nao deve expor:

- dominio operacional;
- banco;
- projeto Railway;
- IDs internos de gateway;
- nomes reais de usuarios.

### 5. Dependencias

Antes de publicar, revisar:

```powershell
npm audit
```

Vulnerabilidades conhecidas devem estar corrigidas ou documentadas.

### 6. Branch e PR

Publicar a partir de uma branch limpa.

Recomendado:

1. criar branch de sanitizacao;
2. remover dados sensiveis;
3. revisar diff;
4. rodar verificacoes;
5. abrir PR;
6. somente depois tornar o repositorio publico.

## Estado atual

O repositorio foi ajustado para reduzir exposicao em arquivos versionados.

Antes de publicar de fato, ainda e recomendado:

- rodar um scanner de segredos no repositorio completo;
- revisar o historico Git;
- rotacionar qualquer segredo que ja tenha sido compartilhado fora do Railway;
- confirmar que HML/PRD nao dependem de credenciais que apareceram em conversa, prints ou commits antigos.
