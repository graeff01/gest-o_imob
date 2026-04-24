/**
 * GET /api/cep-lookup?address=Rua+General+Lima+e+Silva
 * -------------------------------------------------------
 * Proxy para a API ViaCEP — busca CEP a partir do logradouro em Porto Alegre/RS.
 * Retorna até 5 resultados ordenados por relevância.
 */

import { NextRequest, NextResponse } from "next/server";

interface ViaCEPResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address || address.length < 3) {
    return NextResponse.json({ error: "Informe ao menos 3 caracteres do logradouro." }, { status: 400 });
  }

  // Extrai só o nome da rua (remove número, complemento, bairro)
  // Ex: "Rua General Lima e Silva, 123 - Cidade Baixa" → "Rua General Lima e Silva"
  const streetOnly = address
    .replace(/,.*$/, "")         // remove tudo após a primeira vírgula
    .replace(/\s+\d+.*$/, "")   // remove número e o que vem depois
    .trim();

  // ViaCEP: /ws/{UF}/{Cidade}/{Logradouro}/json/
  const encoded = encodeURIComponent(streetOnly);
  const url = `https://viacep.com.br/ws/RS/Porto%20Alegre/${encoded}/json/`;

  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Serviço ViaCEP indisponível." }, { status: 502 });
    }

    const data: ViaCEPResult[] | { erro: boolean } = await res.json();

    // ViaCEP retorna { erro: true } quando não encontra nada
    if (!Array.isArray(data)) {
      return NextResponse.json({ results: [] });
    }

    const results = data
      .filter((r) => !r.erro)
      .slice(0, 5)
      .map((r) => ({
        cep: r.cep.replace("-", ""),
        cep_formatted: r.cep,
        logradouro: r.logradouro,
        bairro: r.bairro,
        cidade: r.localidade,
        uf: r.uf,
      }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Erro ao consultar ViaCEP." }, { status: 502 });
  }
}
