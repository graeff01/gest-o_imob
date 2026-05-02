/**
 * Motor de Processamento IA para Documentos Financeiros
 *
 * Pipeline: Foto/PDF â†’ GPT-4o Vision â†’ Dados Estruturados â†’ ClassificaÃ§Ã£o â†’ InserÃ§Ã£o no Sistema
 *
 * Pronto para funcionar ao configurar OPENAI_API_KEY no .env
 */

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIPOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type DocumentType =
  | "DESPESA"           // Nota de mercado, conta de luz, boleto, etc.
  | "RECEITA"           // Comprovante de recebimento, PIX recebido
  | "NOTA_FISCAL"       // NF de serviÃ§o (corretor, prestador)
  | "EXTRATO_BANCARIO"  // Extrato de banco ou plataforma
  | "COMISSAO"          // Recibo/NF de comissÃ£o de corretor
  | "IMPOSTO"           // DARF, guia de ISS, IPTU
  | "COMPROVANTE_PIX"   // Comprovante de transferÃªncia PIX/TED
  | "CONTRATO"          // Contrato de locaÃ§Ã£o ou venda
  | "OUTROS";

export interface AIExtractionResult {
  // Dados do documento
  tipo_documento: DocumentType;
  valor: number;
  data_documento: string; // DD/MM/YYYY
  descricao: string;

  // Emissor/BeneficiÃ¡rio
  emissor_nome: string;
  emissor_cnpj_cpf: string;

  // ClassificaÃ§Ã£o financeira
  categoria_sugerida: string;      // Nome da categoria do sistema
  subcategoria_sugerida: string;   // Subcategoria especÃ­fica
  departamento: "LOCACAO" | "VENDA" | "AMBOS";

  // Destino no sistema
  destino: "expenses" | "revenues" | "invoices" | "bank_transactions" | "manual";
  destino_descricao: string;       // Ex: "LanÃ§ar como Despesa em Contas de Consumo"

  // Campos extras (quando aplicÃ¡vel)
  numero_nf?: string;
  corretor_vinculado?: string;
  contrato_referencia?: string;
  metodo_pagamento?: string;
  parcela_info?: string;

  // ConfianÃ§a da IA
  confianca: number; // 0-100
  observacoes: string;
}

export interface ProcessingResult {
  success: boolean;
  data?: AIExtractionResult;
  error?: string;
  raw_response?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROMPT DO SISTEMA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const SYSTEM_PROMPT = `VocÃª Ã© um assistente financeiro especializado em imobiliÃ¡rias brasileiras.
Sua funÃ§Ã£o Ã© analisar imagens de documentos financeiros e extrair TODOS os dados relevantes.

CONTEXTO: Operacao imobiliaria com rotinas financeiras, fiscais e administrativas.
Trabalha com locaÃ§Ã£o e venda de imÃ³veis. Possui corretores CLT e PJ.

CATEGORIAS DE DESPESA DO SISTEMA (use exatamente estes nomes):
- Contas de Consumo: Luz/Energia, Agua, Telefone/Internet, Gas, Condominio escritorio
- Material: Escritorio, Limpeza, Copa/Cozinha, Informatica, Impressao
- ManutenÃ§Ã£o: Predial, Equipamentos, Ar condicionado, Eletrica, Hidraulica, Pintura
- Contas Operacionais Venda: Publicidade venda, Placas, Fotos imoveis, CRECI, Cartorio
- Contas Operacionais LocaÃ§Ã£o: Publicidade locaÃ§Ã£o, Placas locaÃ§Ã£o, Vistorias, Seguros, Marketing digital
- Folha de Pagamentos - Venda: Salarios venda, Comissoes venda, FGTS, INSS, Vale transporte, Vale refeiÃ§Ã£o
- Folha de Pagamentos - LocaÃ§Ã£o: Salarios locaÃ§Ã£o, Comissoes locaÃ§Ã£o, FGTS, INSS, Vale transporte
- Tarifas BancÃ¡rias: Manutencao conta, DOC/TED, Boletos emitidos, Anuidade cartao, Juros/Multas
- Impostos e Tributos: ISS, IRPJ, CSLL, PIS, COFINS, IPTU escritorio, Alvara, Simples Nacional
- Gastos EspaÃ§o FÃ­sico: Aluguel escritorio, Condominio, IPTU, Seguro predial, Limpeza terceirizada

CATEGORIAS DE RECEITA:
- ALUGUEL, TAXA_ADMINISTRACAO, COMISSAO_VENDA, COMISSAO_LOCACAO, SEGURO, MULTA_CONTRATUAL, OUTROS

TIPOS DE SERVIÃ‡O (para Notas Fiscais):
- INTERMEDIACAO (locaÃ§Ã£o ou venda), AGENCIAMENTO (captaÃ§Ã£o), ADMINISTRACAO (taxa mensal)

Ao analisar um documento, retorne SEMPRE um JSON vÃ¡lido com esta estrutura exata:
{
  "tipo_documento": "DESPESA|RECEITA|NOTA_FISCAL|EXTRATO_BANCARIO|COMISSAO|IMPOSTO|COMPROVANTE_PIX|CONTRATO|OUTROS",
  "valor": 0.00,
  "data_documento": "DD/MM/YYYY",
  "descricao": "descriÃ§Ã£o clara do que Ã© o documento",
  "emissor_nome": "nome do emissor/beneficiÃ¡rio",
  "emissor_cnpj_cpf": "XX.XXX.XXX/XXXX-XX ou XXX.XXX.XXX-XX",
  "categoria_sugerida": "nome exato da categoria pai",
  "subcategoria_sugerida": "nome exato da subcategoria",
  "departamento": "LOCACAO|VENDA|AMBOS",
  "destino": "expenses|revenues|invoices|bank_transactions|manual",
  "destino_descricao": "explicaÃ§Ã£o de onde lanÃ§ar no sistema",
  "numero_nf": "nÃºmero se for NF",
  "corretor_vinculado": "nome do corretor se mencionado",
  "contrato_referencia": "nÃºmero do contrato se mencionado",
  "metodo_pagamento": "PIX|BOLETO|CARTAO|TRANSFERENCIA|DINHEIRO|DEBITO_AUTOMATICO",
  "parcela_info": "1/3 ou null",
  "confianca": 85,
  "observacoes": "observaÃ§Ãµes relevantes para a gestÃ£o"
}

REGRAS:
1. SEMPRE retorne JSON vÃ¡lido, sem markdown, sem explicaÃ§Ãµes fora do JSON
2. Se nÃ£o conseguir ler um campo, use "NÃƒO IDENTIFICADO" ou 0
3. A confianÃ§a deve refletir a qualidade da leitura (foto ruim = confianÃ§a baixa)
4. Para notas de supermercado/mercado, classifique como DESPESA > Material > Copa/Cozinha
5. Para NF de corretor/prestador, classifique como COMISSAO e sugira vincular Ã  folha
6. Para comprovantes PIX, identifique se Ã© entrada ou saÃ­da pelo contexto
7. Para boletos, identifique o tipo pelo cedente (CEEE=luz, DMAE=Ã¡gua, etc.)
8. O campo destino indica qual tabela do sistema deve receber o registro`;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CHAMADA OPENAI
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function processDocumentWithAI(
  imageBase64: string,
  mimeType: string
): Promise<ProcessingResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY nÃ£o configurada. Configure no .env para ativar o processamento IA.",
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este documento financeiro e extraia todos os dados. Retorne APENAS o JSON estruturado.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1, // Baixa temperatura para respostas mais determinÃ­sticas
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Erro OpenAI (${response.status}): ${JSON.stringify(errorData)}`,
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Extrair JSON da resposta (pode vir com ```json wrapper)
    const parsed = extractJSON(content);
    if (!parsed) {
      return {
        success: false,
        error: "NÃ£o foi possÃ­vel extrair dados estruturados da resposta da IA",
        raw_response: content,
      };
    }

    return {
      success: true,
      data: parsed as unknown as AIExtractionResult,
      raw_response: content,
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro de conexÃ£o com OpenAI: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MOCK (quando nÃ£o tem API key)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function processDocumentMock(fileName: string): ProcessingResult {
  const name = fileName.toLowerCase();

  // Simula diferentes tipos de documentos baseado no nome do arquivo
  if (name.includes("nf") || name.includes("nota") || name.includes("servic")) {
    return {
      success: true,
      data: {
        tipo_documento: "COMISSAO",
        valor: 1850.00,
        data_documento: new Date().toLocaleDateString("pt-BR"),
        descricao: "Nota Fiscal de ServiÃ§o - IntermediaÃ§Ã£o de LocaÃ§Ã£o",
        emissor_nome: "LUCAS RODRIGUES CONSULTORIA IMOB.",
        emissor_cnpj_cpf: "00.000.000/0000-00",
        categoria_sugerida: "Folha de Pagamentos - LocaÃ§Ã£o",
        subcategoria_sugerida: "Comissoes locaÃ§Ã£o",
        departamento: "LOCACAO",
        destino: "invoices",
        destino_descricao: "Registrar como NF de comissÃ£o e vincular Ã  Folha de Pagamento",
        numero_nf: "2026/00147",
        corretor_vinculado: "Lucas Rodrigues",
        metodo_pagamento: "PIX",
        confianca: 92,
        observacoes: "NF de prestador PJ. Verificar se jÃ¡ consta na folha do mÃªs.",
      },
    };
  }

  if (name.includes("mercado") || name.includes("super") || name.includes("zaffari") || name.includes("carrefour")) {
    return {
      success: true,
      data: {
        tipo_documento: "DESPESA",
        valor: 287.45,
        data_documento: new Date().toLocaleDateString("pt-BR"),
        descricao: "Compra de suprimentos - Supermercado Zaffari",
        emissor_nome: "ZAFFARI COMERCIO E INDUSTRIA",
        emissor_cnpj_cpf: "00.000.000/0000-00",
        categoria_sugerida: "Material",
        subcategoria_sugerida: "Copa/Cozinha",
        departamento: "AMBOS",
        destino: "expenses",
        destino_descricao: "LanÃ§ar como Despesa em Material > Copa/Cozinha",
        metodo_pagamento: "CARTAO",
        confianca: 95,
        observacoes: "Nota de supermercado. Itens de copa e cozinha para o escritÃ³rio.",
      },
    };
  }

  if (name.includes("luz") || name.includes("ceee") || name.includes("energia") || name.includes("rge")) {
    return {
      success: true,
      data: {
        tipo_documento: "DESPESA",
        valor: 847.50,
        data_documento: new Date().toLocaleDateString("pt-BR"),
        descricao: "Conta de energia elÃ©trica - CEEE Equatorial",
        emissor_nome: "CEEE EQUATORIAL ENERGIA",
        emissor_cnpj_cpf: "00.000.000/0000-00",
        categoria_sugerida: "Contas de Consumo",
        subcategoria_sugerida: "Luz/Energia",
        departamento: "AMBOS",
        destino: "expenses",
        destino_descricao: "LanÃ§ar como Despesa em Contas de Consumo > Luz/Energia",
        metodo_pagamento: "BOLETO",
        confianca: 97,
        observacoes: "Fatura mensal. Vencimento identificado no documento.",
      },
    };
  }

  if (name.includes("pix") || name.includes("comprovante") || name.includes("transf")) {
    return {
      success: true,
      data: {
        tipo_documento: "COMPROVANTE_PIX",
        valor: 3200.00,
        data_documento: new Date().toLocaleDateString("pt-BR"),
        descricao: "PIX Recebido - Aluguel Ap 301 Av. IndependÃªncia",
        emissor_nome: "JOÃƒO CARLOS MENDES",
        emissor_cnpj_cpf: "000.000.000-00",
        categoria_sugerida: "Receita",
        subcategoria_sugerida: "Aluguel",
        departamento: "LOCACAO",
        destino: "revenues",
        destino_descricao: "LanÃ§ar como Receita de Aluguel e conciliar com extrato",
        contrato_referencia: "MV-2026-0001",
        metodo_pagamento: "PIX",
        confianca: 88,
        observacoes: "Comprovante de PIX recebido. Verificar vÃ­nculo com contrato.",
      },
    };
  }

  if (name.includes("iptu") || name.includes("iss") || name.includes("darf") || name.includes("imposto") || name.includes("guia")) {
    return {
      success: true,
      data: {
        tipo_documento: "IMPOSTO",
        valor: 1250.00,
        data_documento: new Date().toLocaleDateString("pt-BR"),
        descricao: "Guia de ISS sobre serviÃ§os de intermediaÃ§Ã£o - MarÃ§o/2026",
        emissor_nome: "PREFEITURA MUNICIPAL DE PORTO ALEGRE",
        emissor_cnpj_cpf: "00.000.000/0000-00",
        categoria_sugerida: "Impostos e Tributos",
        subcategoria_sugerida: "ISS",
        departamento: "AMBOS",
        destino: "expenses",
        destino_descricao: "LanÃ§ar como Despesa em Impostos e Tributos > ISS",
        metodo_pagamento: "BOLETO",
        confianca: 90,
        observacoes: "Guia de imposto municipal. Verificar competÃªncia e prazo.",
      },
    };
  }

  if (name.includes("google") || name.includes("facebook") || name.includes("meta") || name.includes("ads") || name.includes("marketing")) {
    return {
      success: true,
      data: {
        tipo_documento: "DESPESA",
        valor: 1500.00,
        data_documento: new Date().toLocaleDateString("pt-BR"),
        descricao: "Google Ads - Campanha Locacao Exemplo",
        emissor_nome: "GOOGLE BRASIL INTERNET LTDA",
        emissor_cnpj_cpf: "00.000.000/0000-00",
        categoria_sugerida: "Contas Operacionais LocaÃ§Ã£o",
        subcategoria_sugerida: "Marketing digital",
        departamento: "LOCACAO",
        destino: "expenses",
        destino_descricao: "LanÃ§ar como Despesa em Op. LocaÃ§Ã£o > Marketing digital",
        metodo_pagamento: "CARTAO",
        confianca: 94,
        observacoes: "Fatura de ads. Vincular Ã  campanha ativa se houver.",
      },
    };
  }

  if (name.includes("extrato") || name.includes("caixa") || name.includes("banco") || name.includes("pipeimob")) {
    return {
      success: true,
      data: {
        tipo_documento: "EXTRATO_BANCARIO",
        valor: 0,
        data_documento: new Date().toLocaleDateString("pt-BR"),
        descricao: "Extrato bancÃ¡rio - MÃºltiplas transaÃ§Ãµes identificadas",
        emissor_nome: "CAIXA ECONÃ”MICA FEDERAL",
        emissor_cnpj_cpf: "00.000.000/0000-00",
        categoria_sugerida: "Extrato",
        subcategoria_sugerida: "Extrato mensal",
        departamento: "AMBOS",
        destino: "bank_transactions",
        destino_descricao: "Importar via mÃ³dulo de Extratos BancÃ¡rios para conciliaÃ§Ã£o",
        metodo_pagamento: "PIX",
        confianca: 80,
        observacoes: "Extrato com mÃºltiplas transaÃ§Ãµes. Recomendado usar o importador de extratos para processamento em lote.",
      },
    };
  }

  // GenÃ©rico
  return {
    success: true,
    data: {
      tipo_documento: "OUTROS",
      valor: 150.00,
      data_documento: new Date().toLocaleDateString("pt-BR"),
      descricao: "Documento nÃ£o classificado automaticamente",
      emissor_nome: "NÃƒO IDENTIFICADO",
      emissor_cnpj_cpf: "NÃƒO IDENTIFICADO",
      categoria_sugerida: "Outros",
      subcategoria_sugerida: "Outros",
      departamento: "AMBOS",
      destino: "manual",
      destino_descricao: "ClassificaÃ§Ã£o manual necessÃ¡ria. Revise os dados e selecione a categoria.",
      confianca: 30,
      observacoes: "A IA nÃ£o conseguiu identificar o tipo do documento com certeza. Verifique os dados manualmente.",
    },
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function extractJSON(text: string): Record<string, unknown> | null {
  // Tenta parse direto
  try {
    return JSON.parse(text);
  } catch {
    // Tenta extrair de blocos ```json ... ```
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // fallthrough
      }
    }

    // Tenta encontrar o primeiro { ... } no texto
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        return null;
      }
    }

    return null;
  }
}

/**
 * Converte File para base64
 */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Mapeia o destino para uma label amigÃ¡vel
 */
export function getDestinoLabel(destino: string): string {
  const labels: Record<string, string> = {
    expenses: "Despesas (Financeiro)",
    revenues: "Receitas (Financeiro)",
    invoices: "Notas Fiscais",
    bank_transactions: "Extratos BancÃ¡rios",
    manual: "ClassificaÃ§Ã£o Manual",
  };
  return labels[destino] || destino;
}

/**
 * Retorna a cor do badge pelo tipo de documento
 */
export function getDocTypeColor(tipo: DocumentType): { bg: string; text: string } {
  const colors: Record<DocumentType, { bg: string; text: string }> = {
    DESPESA: { bg: "bg-red-50", text: "text-red-700" },
    RECEITA: { bg: "bg-green-50", text: "text-green-700" },
    NOTA_FISCAL: { bg: "bg-blue-50", text: "text-blue-700" },
    EXTRATO_BANCARIO: { bg: "bg-gray-100", text: "text-gray-700" },
    COMISSAO: { bg: "bg-purple-50", text: "text-purple-700" },
    IMPOSTO: { bg: "bg-amber-50", text: "text-amber-700" },
    COMPROVANTE_PIX: { bg: "bg-emerald-50", text: "text-emerald-700" },
    CONTRATO: { bg: "bg-indigo-50", text: "text-indigo-700" },
    OUTROS: { bg: "bg-gray-50", text: "text-gray-600" },
  };
  return colors[tipo] || colors.OUTROS;
}

export function getDocTypeLabel(tipo: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    DESPESA: "Despesa",
    RECEITA: "Receita",
    NOTA_FISCAL: "Nota Fiscal",
    EXTRATO_BANCARIO: "Extrato BancÃ¡rio",
    COMISSAO: "ComissÃ£o",
    IMPOSTO: "Imposto/Tributo",
    COMPROVANTE_PIX: "Comprovante PIX",
    CONTRATO: "Contrato",
    OUTROS: "Outros",
  };
  return labels[tipo] || tipo;
}
