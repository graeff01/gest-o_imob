# Especificacao Tecnica - Sistema de Gestao Financeira
# Imobiliaria Moinhos de Vento (Auxiliadora Predial)

---

## 1. MAPA COMPLETO DE FUNCIONALIDADES

### CAMADA 0 - INFRAESTRUTURA (deve existir antes de tudo)

| ID | Funcionalidade | Descricao | Justificativa |
|----|---------------|-----------|---------------|
| F0.1 | Estrutura do projeto | Next.js + TypeScript + Tailwind + Prisma | Base tecnica do sistema |
| F0.2 | Banco de dados | PostgreSQL no Railway, schema completo com Prisma | Todas as features dependem do banco |
| F0.3 | Autenticacao e autorizacao | Login, roles (ADMIN, MANAGER, CONSULTANT, VIEWER), protecao de rotas | Seguranca desde o dia 1 |
| F0.4 | Layout base | Sidebar, header, navegacao, responsivo | Todas as telas usam o layout |
| F0.5 | Seed de dados base | Categorias de despesas (154+), regras de comissao, dados iniciais | Referencia para classificacao |

### CAMADA 1 - CADASTROS BASE (entidades que outras features referenciam)

| ID | Funcionalidade | Descricao | Depende de |
|----|---------------|-----------|------------|
| F1.1 | Cadastro de funcionarios/consultores | Nome, CPF, tipo (CLT/Contrato), cargo, contato, status ativo | F0.* |
| F1.2 | Cadastro de proprietarios | Nome, CPF/CNPJ, contato, dados bancarios | F0.* |
| F1.3 | Cadastro de clientes (inquilinos/compradores) | Nome, CPF/CNPJ, contato, email | F0.* |
| F1.4 | Cadastro de imoveis | Endereco, codigo Via/Vista, tipo, status, proprietario vinculado | F0.*, F1.2 |
| F1.5 | Cadastro de contas bancarias | Banco (Caixa, Pipeimob), numero, tipo | F0.* |
| F1.6 | Cadastro de categorias de despesas | Arvore hierarquica (pai/filho), departamento (Venda/Locacao/Admin) | F0.* (vem do seed) |

### CAMADA 2 - OPERACOES CORE (processos do dia a dia)

| ID | Funcionalidade | Descricao | Depende de |
|----|---------------|-----------|------------|
| F2.1 | Gestao de contratos | CRUD de contratos de locacao e venda, vinculo com imovel/cliente/consultor/captador, valores (aluguel, intermediacao, agenciamento), status, datas | F1.1, F1.3, F1.4 |
| F2.2 | Registro de receitas | Entrada manual de receitas por tipo (intermediacao, agenciamento, campanha, NFSe aluguel), vinculo com contrato | F1.6, F2.1 |
| F2.3 | Registro de despesas | Entrada manual de despesas com categoria, data, valor, descricao, departamento (venda/locacao), comprovante | F1.6 |
| F2.4 | Gestao de campanhas | Criar campanhas (sucesso locacao, captacao, semestral), registrar participacoes, calcular premios | F1.1, F2.1 |
| F2.5 | Notas fiscais (NFSe) | Gerar descricao automatica, tracking de status (pendente/emitida/enviada/paga), numeracao sequencial | F2.1 |

### CAMADA 3 - AUTOMACAO FINANCEIRA

| ID | Funcionalidade | Descricao | Depende de |
|----|---------------|-----------|------------|
| F3.1 | Motor de comissoes | Calculo automatico por tier (consultor 10/11/13%, captador 10/11/13%), campanhas (R$100/R$50), vendas (6%), diferenciacao CLT vs Contrato | F1.1, F2.1, F2.4 |
| F3.2 | Importacao de extrato Caixa | Upload Excel -> parser especifico -> transacoes bancarias com categorizacao | F1.5, F1.6 |
| F3.3 | Importacao de extrato Pipeimob | Upload Excel -> parser especifico -> transacoes com tipo (royalty, comissao, taxa, transferencia) | F1.5 |
| F3.4 | Reconciliacao bancaria | Cruzar transacoes bancarias com receitas/despesas registradas, identificar pendencias | F3.2, F3.3, F2.2, F2.3 |
| F3.5 | Gestao de adiantamentos | Tracking de adiantamentos FIDC/Pipeimob, status (pendente/quitado/vencido), reconciliacao com comissoes | F1.1, F3.1 |
| F3.6 | Folha de pagamento | Registro mensal por funcionario: salario, VT, VR, comissao, FGTS, INSS, ferias, 13o, deducoes | F1.1, F3.1 |
| F3.7 | Tracking de royalties | Controle de pagamentos de royalties para franqueadora (Auxiliadora Predial) | F3.3 |

### CAMADA 4 - ENVIO E PROCESSAMENTO DE DOCUMENTOS

| ID | Funcionalidade | Descricao | Depende de |
|----|---------------|-----------|------------|
| F4.1 | Interface de upload | Drag-drop, selecao de arquivo, captura de foto (mobile), campos basicos (tipo, data, descricao) | F0.4 |
| F4.2 | Processamento de Excel | Detectar tipo de planilha (Caixa, Pipeimob, outro), parsear e importar dados | F3.2, F3.3 |
| F4.3 | OCR de recibos/notas (IA) | GPT-4o Vision: foto -> extrair fornecedor, valor, data, itens | F4.1 |
| F4.4 | Classificacao automatica (IA) | GPT-4o: dado extraido -> sugerir categoria de despesa das 154+ opcoes | F4.3, F1.6 |
| F4.5 | Tela de revisao | Gestor revisa sugestao da IA, confirma ou corrige classificacao antes de salvar | F4.3, F4.4 |
| F4.6 | Historico de uploads | Lista de todos documentos enviados com status (processado/pendente/erro), preview, dados extraidos | F4.1 |
| F4.7 | Armazenamento de arquivos | Upload seguro para cloud storage, vinculo com entidade (despesa, contrato, etc.) | F4.1 |

### CAMADA 5 - RELATORIOS E DASHBOARDS

| ID | Funcionalidade | Descricao | Depende de |
|----|---------------|-----------|------------|
| F5.1 | Dashboard financeiro | Visao geral: receita vs despesa mensal, saldo, graficos de tendencia, top categorias | F2.2, F2.3 |
| F5.2 | Relatorio financeiro mensal | Espelha "Planilha Financeiro MV": faturamento, despesas por categoria, folha, tarifas | F2.2, F2.3, F3.6 |
| F5.3 | Relatorio de comissoes | Por consultor: locacoes, tier aplicado, valor comissao, campanhas, total | F3.1 |
| F5.4 | Relatorio de folha | Por funcionario: todos componentes salariais, total bruto/liquido | F3.6 |
| F5.5 | Dashboard de campanhas | Campanhas ativas, participacoes, premios pagos/pendentes | F2.4 |
| F5.6 | Analise de estrutura de receita | Comparativo CLT vs Contrato, custo por funcionario, margem por tipo | F3.1, F3.6 |
| F5.7 | Relatorio DIMOB | Compilacao anual para declaracao fiscal | F2.1, F2.2 |
| F5.8 | Exportacao para Excel | Qualquer relatorio exportavel em formato xlsx | F5.* |

---

## 2. ORDEM DE IMPLEMENTACAO (com justificativa)

### ETAPA 1 - BASE SOLIDA (Semanas 1-3)
**Objetivo: Nada funciona sem isso. Zero codigo de feature antes disso estar pronto.**

```
F0.1 Estrutura do projeto
 └── F0.2 Banco de dados (schema completo)
      └── F0.3 Autenticacao
           └── F0.4 Layout base
                └── F0.5 Seed de dados
```

**Entregavel:** Sistema rodando com login, layout funcional, banco de dados com todas as tabelas criadas e dados base importados.

**Criterios de qualidade:**
- Schema do Prisma cobrindo TODAS as entidades (nao adicionar tabelas depois)
- Autenticacao com hash bcrypt, tokens JWT, middleware de protecao
- Roles implementados no middleware (nao apenas no frontend)
- Layout responsivo testado em mobile
- Variaveis de ambiente documentadas (.env.example)
- Seeds reproduziveis (rodar multiplas vezes sem duplicar)

---

### ETAPA 2 - CADASTROS (Semanas 3-5)
**Objetivo: Ter os dados mestres que todas as operacoes vao referenciar.**

```
F1.1 Funcionarios/Consultores
F1.2 Proprietarios
F1.3 Clientes
F1.4 Imoveis (depende de F1.2)
F1.5 Contas bancarias
F1.6 Categorias (ja vem do seed, apenas UI de visualizacao/edicao)
```

**Entregavel:** Todas as telas de cadastro funcionando com CRUD completo.

**Criterios de qualidade:**
- Validacao no frontend E no backend (nunca confiar apenas no frontend)
- CPF/CNPJ com validacao de digitos
- Busca e filtros em todas as listagens
- Paginacao server-side (nao carregar 1000+ registros no cliente)
- Soft delete (nunca apagar dados financeiros, apenas desativar)
- Audit trail: created_at, updated_at, created_by em todas tabelas

---

### ETAPA 3 - OPERACOES CORE (Semanas 5-8)
**Objetivo: Digitalizar os processos diarios da imobiliaria.**

```
F2.1 Contratos (depende de todos cadastros)
 ├── F2.2 Receitas (depende de F2.1, F1.6)
 ├── F2.3 Despesas (depende de F1.6)
 ├── F2.4 Campanhas (depende de F1.1, F2.1)
 └── F2.5 Notas Fiscais (depende de F2.1)
```

**Entregavel:** Gestores podem registrar contratos, receitas, despesas e acompanhar campanhas.

**Criterios de qualidade:**
- Contratos com todos campos da planilha "Moinhos Janeiro" (69 colunas mapeadas)
- Valores monetarios armazenados como Decimal (nunca float)
- Validacao de datas (contrato nao pode terminar antes de comecar)
- Status transitions controladas (contrato ATIVO nao pode voltar a PENDENTE)
- Descricao NFSe gerada automaticamente (substituir CONCATENATE do Excel)

---

### ETAPA 4 - AUTOMACAO FINANCEIRA (Semanas 8-12)
**Objetivo: Eliminar calculos manuais e importacoes de planilha.**

```
F3.1 Motor de comissoes
F3.2 Import extrato Caixa
F3.3 Import extrato Pipeimob
F3.4 Reconciliacao bancaria (depende de F3.2, F3.3)
F3.5 Adiantamentos (depende de F3.1)
F3.6 Folha de pagamento (depende de F3.1)
F3.7 Royalties (depende de F3.3)
```

**Entregavel:** Comissoes calculadas automaticamente, extratos importados e categorizados, folha gerada.

**Criterios de qualidade:**
- Motor de comissoes com testes unitarios cobrindo TODOS os cenarios do Comissionamentos.docx
- Parsers de extrato com tratamento de erro robusto (formato invalido, colunas faltando)
- Deduplicacao de transacoes (importar mesmo extrato 2x nao duplica)
- Reconciliacao com tolerancia de centavos (R$0.01 de diferenca = match)
- Adiantamentos com alertas de vencimento

---

### ETAPA 5 - ENVIO DE DOCUMENTOS (Semanas 12-16)
**Objetivo: Interface para gestores enviarem notas e comprovantes.**

```
F4.1 Interface de upload
 ├── F4.2 Processamento Excel
 ├── F4.3 OCR (OpenAI GPT-4o)
 ├── F4.4 Classificacao automatica
 ├── F4.5 Tela de revisao
 ├── F4.6 Historico
 └── F4.7 Armazenamento
```

**Entregavel:** Gestores fazem upload de fotos/planilhas, sistema processa e classifica.

**Criterios de qualidade:**
- Upload com limite de tamanho (10MB imagem, 50MB Excel)
- Processamento assincrono (nao travar UI enquanto IA processa)
- Fallback gracioso se API OpenAI falhar (permitir entrada manual)
- Imagens comprimidas antes de armazenar
- Dados extraidos pela IA SEMPRE passam por revisao humana antes de salvar

---

### ETAPA 6 - RELATORIOS (Semanas 16-20)
**Objetivo: Visibilidade completa sobre a saude financeira.**

```
F5.1 Dashboard (depende de F2.2, F2.3)
F5.2 Relatorio financeiro mensal (depende de F2.*, F3.6)
F5.3 Relatorio comissoes (depende de F3.1)
F5.4 Relatorio folha (depende de F3.6)
F5.5 Dashboard campanhas (depende de F2.4)
F5.6 Estrutura receita (depende de F3.1, F3.6)
F5.7 DIMOB (depende de F2.1, F2.2)
F5.8 Exportacao Excel (transversal)
```

**Entregavel:** Todos os relatorios que hoje sao feitos manualmente, gerados automaticamente.

---

## 3. DEPENDENCIAS VISUAIS (Grafo)

```
CAMADA 0: [Projeto] -> [Banco] -> [Auth] -> [Layout] -> [Seed]
               |
CAMADA 1:      +-> [Funcionarios] [Proprietarios] [Clientes] [Contas] [Categorias]
               |        |              |              |
CAMADA 2:      |   [Imoveis]          |              |
               |        |              |              |
               |   [Contratos] <------+------+-------+
               |     |    |    |
               |  [Receitas] [Despesas] [Campanhas] [NFSe]
               |     |    |       |         |
CAMADA 3:      | [Comissoes] <----+---------+
               |     |
               | [Import Caixa] [Import Pipeimob]
               |     |              |
               | [Reconciliacao] <--+
               |     |
               | [Adiantamentos] [Folha] [Royalties]
               |
CAMADA 4:      +-> [Upload] -> [OCR] -> [Classificacao] -> [Revisao]
               |
CAMADA 5:      +-> [Dashboard] [Relatorios] [Exportacao]
```

---

## 4. PRINCIPIOS TECNICOS (aplicados em todo o desenvolvimento)

### Seguranca
- **Autenticacao**: bcrypt para senhas, JWT com expiracao curta + refresh token
- **Autorizacao**: middleware server-side verificando role em TODA rota API
- **Input validation**: Zod schemas em todas as APIs (nunca confiar no frontend)
- **SQL injection**: Prisma ORM parametriza queries automaticamente
- **XSS**: React escapa output por padrao, sanitizar inputs ricos
- **CSRF**: NextAuth.js inclui protecao CSRF
- **Dados sensiveis**: CPF/CNPJ nunca em logs, mascarar em listagens
- **HTTPS**: Vercel fornece SSL automaticamente
- **Rate limiting**: Em rotas de login e APIs publicas

### Qualidade de Dados
- **Valores monetarios**: Prisma Decimal (nao Float) -> precisao de centavos
- **Datas**: Sempre UTC no banco, converter para BRT apenas na exibicao
- **Soft delete**: Registros financeiros nunca sao apagados, apenas marcados is_active=false
- **Audit trail**: created_at, updated_at, created_by em todas tabelas
- **Deduplicacao**: Chaves unicas compostas onde aplicavel (ex: transacao bancaria = banco+data+doc+valor)

### Performance
- **Paginacao server-side**: Todas as listagens com cursor-based ou offset pagination
- **Indices**: Em colunas usadas em WHERE/ORDER BY (date, status, category_id, consultant_id)
- **Lazy loading**: Carregar dados sob demanda, nao tudo de uma vez
- **Cache**: React Query (TanStack Query) para cache client-side com invalidacao inteligente

### Organizacao de Codigo
- **Separacao de responsabilidades**: API routes -> Services -> Prisma (nunca Prisma direto na route)
- **Tipos compartilhados**: src/types/ com interfaces usadas por frontend e backend
- **Validacao compartilhada**: Zod schemas em src/lib/validations/ usados em forms e APIs
- **Componentes reutilizaveis**: DataTable, FormField, MoneyInput, DatePicker, StatusBadge
- **Constantes centralizadas**: Enums, mensagens de erro, configuracoes em src/lib/constants/

---

## 5. SCHEMA DO BANCO DE DADOS (especificacao completa)

### Tabelas e campos detalhados:

**User**
- id: UUID (PK)
- name: String (not null)
- email: String (unique, not null)
- password_hash: String (not null)
- role: Enum (ADMIN, MANAGER, CONSULTANT, VIEWER)
- employee_type: Enum (CLT, CONTRACT, PARTNER) nullable
- is_active: Boolean (default true)
- created_at: DateTime
- updated_at: DateTime

**Employee** (extends User com dados de funcionario)
- id: UUID (PK)
- user_id: FK -> User (unique)
- cpf: String (unique, encrypted at rest)
- position: Enum (CONSULTOR, CAPTADOR, GERENTE, RECEPCAO, ESTAGIARIO, MANUTENCAO, MKT)
- department: Enum (VENDA, LOCACAO, ADMIN)
- hire_date: Date
- contract_type: Enum (CLT, CONTRACT)
- base_salary: Decimal (nullable - CLT only)
- bank_name: String (nullable)
- bank_agency: String (nullable)
- bank_account: String (nullable)
- is_active: Boolean (default true)
- created_at, updated_at: DateTime

**PropertyOwner**
- id: UUID (PK)
- name: String (not null)
- cpf_cnpj: String (unique)
- person_type: Enum (PF, PJ)
- email: String (nullable)
- phone: String (nullable)
- address: String (nullable)
- bank_name: String (nullable)
- bank_agency: String (nullable)
- bank_account: String (nullable)
- bank_pix: String (nullable)
- notes: Text (nullable)
- is_active: Boolean (default true)
- created_at, updated_at: DateTime

**Client**
- id: UUID (PK)
- name: String (not null)
- cpf_cnpj: String (unique)
- person_type: Enum (PF, PJ)
- email: String (nullable)
- phone: String (nullable)
- address: String (nullable)
- notes: Text (nullable)
- is_active: Boolean (default true)
- created_at, updated_at: DateTime

**Property**
- id: UUID (PK)
- via_code: String (nullable, index)
- vista_code: String (nullable, index)
- owner_id: FK -> PropertyOwner
- address_street: String (not null)
- address_number: String
- address_complement: String (nullable)
- address_neighborhood: String
- address_city: String (default "Porto Alegre")
- address_state: String (default "RS")
- address_cep: String (nullable)
- property_type: Enum (APARTAMENTO, CASA, COMERCIAL, SALA, TERRENO, OUTRO)
- status: Enum (DISPONIVEL, LOCADO, VENDIDO, INATIVO)
- rent_value: Decimal (nullable)
- sale_value: Decimal (nullable)
- area_m2: Decimal (nullable)
- bedrooms: Int (nullable)
- parking_spots: Int (nullable)
- notes: Text (nullable)
- is_active: Boolean (default true)
- created_at, updated_at: DateTime

**Contract**
- id: UUID (PK)
- contract_number: String (unique, auto-generated)
- via_code: String (nullable, index)
- property_id: FK -> Property
- client_id: FK -> Client
- consultant_id: FK -> Employee (nullable)
- captador_id: FK -> Employee (nullable)
- contract_type: Enum (LOCACAO, VENDA)
- status: Enum (PENDENTE, ATIVO, ENCERRADO, CANCELADO, RENOVADO)
- start_date: Date (not null)
- end_date: Date (nullable)
- rent_value: Decimal (nullable) -- VGL (valor global locacao)
- sale_value: Decimal (nullable)
- intermediation_value: Decimal (nullable) -- 70% do VGL
- agency_value: Decimal (nullable) -- 30% do VGL
- franchise_intermediation_value: Decimal (nullable)
- admin_fee_percentage: Decimal (default 10.0)
- guarantee_type: Enum (CAUCAO, FIADOR, SEGURO_FIANCA, TITULO_CAPITALIZACAO, NENHUMA) nullable
- inspection_status: Enum (PENDENTE, AGENDADA, REALIZADA) nullable
- inspection_date: Date (nullable)
- key_status: Enum (PENDENTE, ENTREGUE) nullable
- key_delivery_date: Date (nullable)
- notes: Text (nullable)
- created_by: FK -> User
- created_at, updated_at: DateTime

**ExpenseCategory**
- id: UUID (PK)
- parent_id: FK -> ExpenseCategory (nullable, self-reference)
- name: String (not null)
- code: String (unique, nullable) -- ex: "DESP.CONS.AGUA"
- department: Enum (VENDA, LOCACAO, ADMIN, AMBOS)
- is_active: Boolean (default true)
- sort_order: Int (default 0)
- created_at, updated_at: DateTime

**Revenue** (receitas)
- id: UUID (PK)
- contract_id: FK -> Contract (nullable)
- category: Enum (INTERMEDIACAO, AGENCIAMENTO, CAMPANHA_SUCESSO, CAMPANHA_CAPTACAO, NFSE_ALUGUEL, ROYALTY, OUTRO)
- description: String (not null)
- amount: Decimal (not null)
- date: Date (not null)
- department: Enum (VENDA, LOCACAO)
- reference_month: Int (1-12)
- reference_year: Int
- notes: Text (nullable)
- document_id: FK -> Document (nullable)
- created_by: FK -> User
- created_at, updated_at: DateTime

**Expense** (despesas)
- id: UUID (PK)
- category_id: FK -> ExpenseCategory
- description: String (not null)
- amount: Decimal (not null)
- date: Date (not null)
- due_date: Date (nullable)
- paid_date: Date (nullable)
- department: Enum (VENDA, LOCACAO, ADMIN)
- payment_method: Enum (PIX, BOLETO, CARTAO, DINHEIRO, DEBITO_AUTOMATICO, TRANSFERENCIA)
- status: Enum (PENDENTE, PAGO, VENCIDO, CANCELADO)
- reference_month: Int (1-12)
- reference_year: Int
- supplier: String (nullable)
- notes: Text (nullable)
- document_id: FK -> Document (nullable)
- created_by: FK -> User
- created_at, updated_at: DateTime

**BankAccount**
- id: UUID (PK)
- bank_name: String (not null) -- "Caixa Economica Federal", "Pipeimob"
- bank_code: String (nullable) -- "104", etc
- account_number: String (not null)
- account_type: Enum (CORRENTE, POUPANCA, PLATAFORMA)
- current_balance: Decimal (default 0)
- is_active: Boolean (default true)
- created_at, updated_at: DateTime

**BankTransaction**
- id: UUID (PK)
- bank_account_id: FK -> BankAccount
- external_id: String (nullable) -- ID no sistema externo (Pipeimob UUID, etc)
- operation_type: String -- "CRED PIX", "PAG BOLETO", "Royalties", etc
- date: Date (not null)
- time: Time (nullable)
- doc_number: String (nullable)
- description: String (not null)
- amount: Decimal (not null) -- positivo = credito, negativo = debito
- balance: Decimal (nullable) -- saldo apos transacao
- category_id: FK -> ExpenseCategory (nullable)
- is_credit: Boolean (not null)
- is_reconciled: Boolean (default false)
- reconciled_with_type: Enum (REVENUE, EXPENSE, ADVANCE, ROYALTY) nullable
- reconciled_with_id: UUID (nullable)
- source_document_id: FK -> Document (nullable) -- planilha Excel de origem
- import_batch_id: String (nullable) -- para agrupar importacoes
- notes: Text (nullable)
- created_at, updated_at: DateTime
- UNIQUE(bank_account_id, date, doc_number, amount) -- deduplicacao

**CommissionRule**
- id: UUID (PK)
- rule_type: Enum (CONSULTOR_INTERMEDIACAO, CAPTADOR_INTERMEDIACAO, CAPTADOR_BONUS, VENDA, CAMPANHA_SUCESSO, CAMPANHA_CAPTACAO)
- employee_type: Enum (CLT, CONTRACT) nullable -- null = ambos
- min_threshold: Int (not null) -- ex: 0, 4, 10 (locacoes) ou 0, 16, 21 (captacoes)
- max_threshold: Int (nullable) -- null = sem limite
- percentage: Decimal (nullable) -- ex: 10.00, 11.00, 13.00
- fixed_amount: Decimal (nullable) -- ex: 100.00 (campanha sucesso), 50.00 (captacao)
- effective_from: Date (not null)
- effective_to: Date (nullable) -- null = vigente
- description: String (nullable)
- created_at, updated_at: DateTime

**CommissionCalculation**
- id: UUID (PK)
- employee_id: FK -> Employee
- reference_month: Int (1-12)
- reference_year: Int
- rental_count: Int (default 0)
- capture_count: Int (default 0)
- total_intermediation_value: Decimal (default 0)
- tier_applied: String -- "10%", "11%", "13%"
- intermediation_commission: Decimal (default 0)
- campaign_success_amount: Decimal (default 0)
- campaign_capture_amount: Decimal (default 0)
- sale_commission: Decimal (default 0)
- total_commission: Decimal (not null)
- status: Enum (CALCULADO, APROVADO, PAGO)
- approved_by: FK -> User (nullable)
- approved_at: DateTime (nullable)
- paid_at: DateTime (nullable)
- notes: Text (nullable)
- created_by: FK -> User
- created_at, updated_at: DateTime
- UNIQUE(employee_id, reference_month, reference_year)

**CommissionAdvance** (adiantamentos)
- id: UUID (PK)
- employee_id: FK -> Employee
- pipeimob_uuid: String (nullable, unique)
- ccb_id: String (nullable) -- Cedula de Credito Bancario
- advance_date: Date (not null)
- amount: Decimal (not null)
- source: Enum (FIDC_PIPEIMOB, PIX, OUTRO)
- property_code: String (nullable)
- property_address: String (nullable)
- total_commission_expected: Decimal (nullable)
- expected_settlement_date: Date (nullable)
- settlement_amount: Decimal (nullable)
- settlement_date: Date (nullable)
- status: Enum (PENDENTE, PARCIALMENTE_QUITADO, QUITADO, VENCIDO)
- notes: Text (nullable)
- created_at, updated_at: DateTime

**Invoice** (notas fiscais)
- id: UUID (PK)
- contract_id: FK -> Contract (nullable)
- nfse_number: Int (nullable)
- year_sequence: Int (nullable)
- reference_year: Int (not null)
- property_code: String (nullable)
- property_address: String (nullable)
- client_name: String (not null)
- client_cpf_cnpj: String (not null)
- client_contact: String (nullable)
- service_type: Enum (INTERMEDIACAO, AGENCIAMENTO, ADMINISTRACAO)
- title_number: String (nullable)
- amount: Decimal (not null)
- description_title: String -- titulo gerado automaticamente
- description_body: String -- descricao do servico gerada automaticamente
- status: Enum (PENDENTE, EMITIDA, ENVIADA, PAGA, CANCELADA)
- issued_at: DateTime (nullable)
- sent_at: DateTime (nullable)
- paid_at: DateTime (nullable)
- notes: Text (nullable)
- created_by: FK -> User
- created_at, updated_at: DateTime

**Campaign**
- id: UUID (PK)
- name: String (not null)
- campaign_type: Enum (SUCESSO_LOCACAO, CAPTACAO, LOCACAO_SEMESTRAL)
- start_date: Date (not null)
- end_date: Date (nullable)
- reward_type: Enum (FIXO, PERCENTUAL)
- reward_amount: Decimal (not null) -- R$100, R$50, ou percentual
- description: Text (nullable)
- status: Enum (ATIVA, ENCERRADA, CANCELADA)
- created_by: FK -> User
- created_at, updated_at: DateTime

**CampaignEntry** (participacao em campanha)
- id: UUID (PK)
- campaign_id: FK -> Campaign
- employee_id: FK -> Employee
- contract_id: FK -> Contract (nullable)
- property_id: FK -> Property (nullable)
- amount: Decimal (not null)
- reference_month: Int
- reference_year: Int
- status: Enum (PENDENTE, APROVADO, PAGO)
- approved_by: FK -> User (nullable)
- paid_at: DateTime (nullable)
- notes: Text (nullable)
- created_at, updated_at: DateTime

**PayrollEntry** (folha de pagamento)
- id: UUID (PK)
- employee_id: FK -> Employee
- reference_month: Int (1-12)
- reference_year: Int
- base_salary: Decimal (default 0)
- commission: Decimal (default 0) -- vem de CommissionCalculation
- food_allowance: Decimal (default 0) -- VR/VA
- transport_allowance: Decimal (default 0) -- VT
- vacation_pay: Decimal (default 0) -- ferias
- thirteenth_salary: Decimal (default 0) -- 13o
- other_earnings: Decimal (default 0)
- inss_deduction: Decimal (default 0)
- irrf_deduction: Decimal (default 0)
- fgts: Decimal (default 0)
- other_deductions: Decimal (default 0)
- advance_deductions: Decimal (default 0) -- descontos de adiantamentos
- total_gross: Decimal (not null)
- total_deductions: Decimal (not null)
- total_net: Decimal (not null)
- department_split_sale: Decimal (default 0) -- % alocado a Venda
- department_split_rental: Decimal (default 0) -- % alocado a Locacao
- status: Enum (RASCUNHO, CALCULADO, APROVADO, PAGO)
- approved_by: FK -> User (nullable)
- paid_at: DateTime (nullable)
- notes: Text (nullable)
- created_by: FK -> User
- created_at, updated_at: DateTime
- UNIQUE(employee_id, reference_month, reference_year)

**Document** (arquivos enviados)
- id: UUID (PK)
- filename: String (not null)
- original_filename: String (not null)
- mime_type: String (not null)
- file_size: Int (not null) -- bytes
- storage_url: String (not null) -- URL no cloud storage
- uploaded_by: FK -> User
- document_type: Enum (NOTA_FISCAL, RECIBO, EXTRATO_BANCARIO, PLANILHA, COMPROVANTE, CONTRATO, OUTRO)
- ai_extracted_data: Json (nullable) -- dados extraidos pela IA
- ai_classification: String (nullable) -- categoria sugerida
- ai_confidence: Decimal (nullable) -- 0-1
- processing_status: Enum (PENDENTE, PROCESSANDO, PROCESSADO, ERRO)
- processing_error: String (nullable)
- related_entity_type: Enum (EXPENSE, REVENUE, CONTRACT, BANK_TRANSACTION) nullable
- related_entity_id: UUID (nullable)
- is_reviewed: Boolean (default false) -- gestor revisou classificacao da IA
- reviewed_by: FK -> User (nullable)
- reviewed_at: DateTime (nullable)
- created_at, updated_at: DateTime

**RoyaltyPayment**
- id: UUID (PK)
- contract_code: String (nullable)
- pipeimob_transaction_id: String (nullable)
- amount: Decimal (not null)
- date: Date (not null)
- reference_month: Int
- reference_year: Int
- bank_transaction_id: FK -> BankTransaction (nullable)
- description: String (nullable)
- status: Enum (PENDENTE, PAGO, RECONCILIADO)
- created_at, updated_at: DateTime

---

## 6. INDICES DO BANCO DE DADOS

```
-- Performance indices
CREATE INDEX idx_contract_status ON Contract(status);
CREATE INDEX idx_contract_dates ON Contract(start_date, end_date);
CREATE INDEX idx_contract_consultant ON Contract(consultant_id);
CREATE INDEX idx_contract_captador ON Contract(captador_id);
CREATE INDEX idx_expense_date ON Expense(date);
CREATE INDEX idx_expense_category ON Expense(category_id);
CREATE INDEX idx_expense_reference ON Expense(reference_year, reference_month);
CREATE INDEX idx_revenue_date ON Revenue(date);
CREATE INDEX idx_revenue_reference ON Revenue(reference_year, reference_month);
CREATE INDEX idx_bank_tx_date ON BankTransaction(date);
CREATE INDEX idx_bank_tx_account ON BankTransaction(bank_account_id);
CREATE INDEX idx_bank_tx_reconciled ON BankTransaction(is_reconciled);
CREATE INDEX idx_commission_calc_ref ON CommissionCalculation(reference_year, reference_month);
CREATE INDEX idx_payroll_ref ON PayrollEntry(reference_year, reference_month);
CREATE INDEX idx_document_status ON Document(processing_status);
CREATE INDEX idx_document_type ON Document(document_type);
```

---

## 7. CHECKLIST DE VALIDACAO PRE-DESENVOLVIMENTO

Antes de comecar cada etapa, verificar:

- [ ] Schema do banco cobre todas as necessidades da etapa?
- [ ] Validacoes Zod definidas para todos os inputs?
- [ ] Roles de acesso definidos (quem pode ver/editar/deletar)?
- [ ] Estados e transicoes de status documentados?
- [ ] Indices necessarios criados?
- [ ] Tratamento de erro definido (o que mostrar ao usuario)?
- [ ] Dados de teste/seed existem?

---

## 8. RISCOS E MITIGACOES

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Schema incompleto, precisar alterar depois | Alto - migrations em producao | Mapear TODOS os campos das 8 planilhas ANTES de criar schema |
| Regras de comissao mal implementadas | Alto - pagamentos errados | Testes unitarios com TODOS os exemplos do Comissionamentos.docx |
| Parser de extrato quebra com formato diferente | Medio - importacao falha | Validacao robusta, fallback para entrada manual, logs detalhados |
| API OpenAI indisponivel | Baixo - IA e auxiliar | Fallback para entrada manual, IA nunca e caminho unico |
| Performance com muitos dados | Medio - sistema lento | Paginacao server-side, indices, lazy loading desde o inicio |
| Usuarios nao adotam sistema | Alto - projeto fracassa | Interface simples, treinamento, periodo paralelo com planilhas |
