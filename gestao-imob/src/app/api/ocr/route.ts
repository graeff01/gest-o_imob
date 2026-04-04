import { NextResponse } from "next/server";

/**
 * API DE OCR & TRIAGEM INTELIGENTE
 * Agora a IA classifica o documento automaticamente após a leitura.
 */

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // --- LOGICA DE PRODUÇÃO (SIMULADA COM TRIAGEM) ---
    // Em PRD, a IA receberia a imagem e retornaria a 'categoria' baseada no contexto.
    
    // Simulação do tempo de análise da CPU/IA
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Exemplo de como a IA classificaria conforme o nome/conteúdo do arquivo
    const fileName = file.name.toLowerCase();
    
    let categoria = "OUTROS";
    let sugestao = "Conferir manualmente";
    let valor = 150.00;
    let emissor = "FORNECEDOR DIVERSO";
    let corretorSugerido = null;

    if (fileName.includes("nf") || fileName.includes("serviço") || fileName.includes("nota")) {
      categoria = "NF_CORRETOR";
      sugestao = "Vincular à Folha de Pagamento";
      valor = 1850.00;
      emissor = "LUCAS RODRIGUES CONSULTORIA";
      corretorSugerido = "Lucas Rodrigues";
    } else if (fileName.includes("mercado") || fileName.includes("zaffari") || fileName.includes("carrefour")) {
      categoria = "DESPESA_OPERACIONAL";
      sugestao = "Lançar no Financeiro (Gastos)";
      valor = 345.90;
      emissor = "SUPERMERCADO ZAFFARI";
    } else if (fileName.includes("facebook") || fileName.includes("google") || fileName.includes("anuncio")) {
      categoria = "MARKETING";
      sugestao = "Lançar no Financeiro (Marketing)";
      valor = 500.00;
      emissor = "GOOGLE ADS / FB ADS";
    }

    return NextResponse.json({
      success: true,
      data: {
        valor,
        emissor,
        cnpj: "XX.XXX.XXX/0001-XX",
        data: new Date().toLocaleDateString('pt-BR'),
        categoria,
        sugestao,
        corretorSugerido
      }
    });

  } catch (error) {
    return NextResponse.json({ error: "Erro de processamento IA" }, { status: 500 });
  }
}
