import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Resolve o bug do Turbopack com caracteres especiais no path (acentos)
  // Em produção (Vercel), __dirname já é ASCII, então não causa problema
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
