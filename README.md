<div align="center">

# Moinhos de Vento — Gestão Imobiliária

### Sistema de gestão financeira com IA para uma imobiliária real

Substitui 8+ planilhas Excel fragmentadas por um sistema centralizado, onde um hub de IA lê documentos, extrai dados e classifica automaticamente nas áreas corretas — financeiro, contratos, notas fiscais, folha de pagamento e comissões.

**Stack:** Next.js 16 · TypeScript · Prisma · PostgreSQL · OpenAI GPT-4o Vision · Recharts · Tailwind v4

[Sobre](#sobre-o-projeto) · [Arquitetura](#arquitetura) · [Decisões técnicas](#decisões-técnicas-relevantes) · [Rodando localmente](#rodando-localmente)

</div>

---

## Sobre o projeto

Este é um sistema **real**, construído para uma imobiliária que gerencia sua operação financeira através de múltiplas planilhas Excel e documentos Word, com forte dependência de uma única pessoa. O objetivo é centralizar todo o fluxo — desde o upload de uma nota fiscal em foto até o cálculo de comissões por tier e a emissão de relatórios fiscais (DIMOB) — minimizando trabalho manual através de IA.

Não é um CRUD genérico: cada entidade, regra de comissão e categoria de despesa foi modelada a partir dos arquivos originais da imobiliária (contratos, extratos bancários da Caixa e Pipeimob, regras de comissionamento documentadas, estrutura de receita CLT vs PJ).

### O que o sistema faz

| Área | Funcionalidade |
|---|---|
| **Central IA** | Hub único de entrada. Upload de PDF/imagem/planilha → OCR via GPT-4o Vision → extração estruturada → classificação automática → confirmação do gestor → lançamento no módulo correto |
| **Painel customizável** | 15 widgets (KPIs, gráficos, listas) com reordenação drag-controls, submenu de inserção/remoção, redimensionamento 1–4 colunas, persistência por usuário |
| **Contratos** | Gestão de contratos de locação e venda com vínculo a consultor, captador, proprietário e cliente |
| **Financeiro** | Receitas e despesas categorizadas em árvore de 154+ categorias importadas da planilha mestre original |
| **Comissões** | Motor de cálculo por tier (10% / 11% / 13%) baseado nas regras reais do documento `Comissionamentos.docx` da imobiliária |
| **Folha de Pagamento** | Funcionários CLT/PJ com salário fixo + comissão variável, arquitetura preparada para importação de planilha de resultados via IA |
| **Notas Fiscais** | Tracking de NFSe, geração e status de emissão |
| **Extratos bancários** | Parsers dedicados para Caixa e Pipeimob, com conciliação manual e estrutura pronta para automática |
| **Relatórios** | 9 relatórios em 4 categorias (financeiro, operacional, fiscal, RH), com exportação CSV/XLSX/PDF |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Central IA (hub)                         │
│      upload → OCR (GPT-4o Vision) → extração estruturada     │
│              → classificação → confirmação                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────┬───────────┼───────────┬──────────┐
        ▼         ▼           ▼           ▼          ▼
   Financeiro  Contratos  Notas Fiscais  Folha    Comissões
        │         │           │           │          │
        └─────────┴───────────┼───────────┴──────────┘
                              ▼
                  ┌───────────────────────┐
                  │  PostgreSQL (Railway) │
                  │   via Prisma ORM      │
                  └───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   Painel Executivo    │
                  │   (widgets + Recharts)│
                  └───────────────────────┘
```

**Design key:** Central IA **não é uma feature** — é o ponto único de entrada de dados. Módulos internos não têm formulários de criação manual: tudo entra pela IA e é revisado/corrigido pelo gestor.

### Estrutura de pastas

```
gestao-imob/
├── prisma/
│   ├── schema.prisma              # modelo de dados completo
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/login/          # NextAuth v5
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx           # Painel customizável
│   │   │   ├── documentos/        # Central IA
│   │   │   ├── contratos/
│   │   │   ├── financeiro/
│   │   │   ├── comissoes/
│   │   │   ├── folha-corretores/
│   │   │   ├── notas-fiscais/
│   │   │   ├── extratos/
│   │   │   └── relatorios/
│   │   └── api/
│   │       ├── upload/            # processamento de documentos
│   │       └── auth/
│   ├── components/
│   │   ├── layout/                # sidebar, header
│   │   └── upload/                # drag-drop, preview
│   └── lib/
│       ├── prisma.ts              # client resiliente (graceful degradation)
│       ├── ai/
│       │   ├── openai-client.ts
│       │   ├── document-processor.ts
│       │   └── receipt-reader.ts  # GPT-4o Vision
│       ├── finance/
│       │   └── commission-engine.ts  # cálculo de tiers
│       ├── parsers/
│       │   ├── caixa-extrato.ts
│       │   └── pipeimob-extrato.ts
│       └── mock-data.ts           # fallback quando DB offline
```

---

## Decisões técnicas relevantes

### 1. Central IA como único ponto de entrada
Formulários manuais espalhados pelos módulos geravam inconsistência (mesma despesa lançada de duas formas, NF sem contrato vinculado, etc). A decisão foi remover todos os botões "Nova X" dos módulos e **centralizar a entrada pela Central IA**, que classifica e roteia automaticamente. O gestor vira revisor, não digitador.

### 2. Prisma client resiliente com graceful degradation
O sistema precisa rodar em dev **sem banco conectado** (build da Vercel, primeira clonada, testes rápidos). Implementei um proxy em `src/lib/prisma.ts` que intercepta chamadas ao Prisma e, se o DB estiver offline, retorna mock data de forma transparente. Zero `if (process.env...)` espalhado pelo código.

### 3. Painel customizável com persistência local
Implementação de sistema de widgets com:
- Merge inteligente de layouts antigos (usuários não perdem customização quando novos widgets são adicionados em deploys futuros)
- Reordenação via setas ↑/↓ operando sobre índices visíveis (não os totais)
- Redimensionamento respeitando `minSize`/`maxSize` por widget
- Submenu de inserção com checkboxes
- Persistência em `localStorage` versionada (`dashboard-layout-v1`) para migrações futuras

### 4. Folha de pagamento: esqueleto preparado para IA
A função `calculatePayroll(employee, result, rule)` está isolada com corpo placeholder. Quando as regras reais forem integradas, apenas a lógica interna muda — UI, tipos e fluxo ficam intactos. Estrutura genérica (`CommissionRule.parametros: Record<string, unknown>`) acomoda qualquer modelo futuro (tiers, bônus por unidade, híbrido).

### 5. Parsers específicos para extratos bancários reais
Em vez de parser genérico que falharia em 30% dos casos, temos parsers dedicados para os dois bancos que a imobiliária realmente usa (Caixa e Pipeimob), construídos a partir dos arquivos reais fornecidos. Cada um conhece o formato exato de cabeçalho, encoding e linhas de saldo.

### 6. Mock fallbacks em toda a camada de dados
`src/lib/mock-data.ts` contém dados realistas (valores compatíveis com a realidade da imobiliária) usados como fallback quando o DB está offline. Isso garante que o frontend seja sempre demonstrável, independente do estado da infra.

---

## Roadmap — o que vem (planejado, sem dependências externas)

Decisões já tomadas para os próximos pilares estruturais (priorizando profundidade sobre quantidade de features):

1. **Entidades centrais** — Fornecedor e Proprietário como entidades de primeira classe, com cross-reference automático
2. **Parâmetros do sistema como dados** — taxa admin, % repasse matriz, tiers de comissão, régua de cobrança movidos para tela de configuração versionada
3. **Log de auditoria imutável** — toda ação (humana ou IA) registrada com quem/quando/o quê/score de confiança
4. **Matching e conciliação automática** — transação bancária ↔ contrato ↔ NF ↔ repasse esperado, com fila de exceções unificada
5. **IA com memória** — classificações corrigidas viram regras aprendidas (fornecedor → categoria), com score de confiança por sugestão
6. **Fechamento de competência** — botão que trava lançamentos do mês, gera snapshot imutável, calcula comparativo com mês anterior
7. **Saúde operacional** — tela com checagens automáticas (contratos sem proprietário, NF sem contrato, funcionário sem regra)
8. **Busca global (Cmd+K)** — busca universal cruzando contratos, clientes, NFs, despesas, funcionários

---

## Rodando localmente

```bash
git clone <repo>
cd gestao-imob
npm install
cp .env.example .env.local   # opcional — o sistema roda sem DB
npm run dev
```

Acesso: `http://localhost:3000`

Com banco conectado:
```bash
npx prisma migrate dev
npx prisma db seed
```

---

## Stack técnico detalhado

| Camada | Tecnologia | Por quê |
|---|---|---|
| Framework | **Next.js 16** (App Router + Turbopack) | Full-stack num projeto só, streaming SSR, React Server Components |
| Linguagem | **TypeScript** strict | Domínio financeiro não tolera `any` |
| UI | **Tailwind CSS v4** | CSS-in-config, zero runtime overhead |
| Gráficos | **Recharts 3.8** | Declarativo, suficiente para dashboards financeiros |
| Auth | **NextAuth v5** (beta) | Roles (ADMIN/MANAGER/CONSULTANT/VIEWER) |
| ORM | **Prisma** | Type-safe, migrations automáticas |
| Banco | **PostgreSQL** (Railway) | JSON nativo, robusto para dados financeiros |
| IA | **OpenAI GPT-4o Vision** | OCR de recibos + classificação de transações |
| Parsing | **SheetJS (xlsx)** | Importação de extratos bancários |
| Ícones | **Lucide React** | Consistência visual |

---

## Sobre o desenvolvedor

Este projeto foi construído a partir de um problema real: a digitalização do fluxo financeiro de uma imobiliária familiar que dependia de planilhas e de uma única pessoa. Cada decisão — desde a Central IA como hub único, até os parsers específicos dos extratos bancários — nasceu da conversa direta com quem opera o negócio.

Mais do que um exercício técnico, é um estudo de como **reduzir trabalho manual através de IA aplicada ao contexto**, sem perder a auditabilidade que um sistema financeiro exige.

---

<div align="center">

**Construído com foco em arquitetura, não em features.**

</div>
