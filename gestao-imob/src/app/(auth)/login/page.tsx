"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { environmentLabel, environmentName, isNonProduction } from "@/lib/app-env";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou senha incorretos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] lg:grid lg:grid-cols-[minmax(420px,44vw)_1fr]">
      <section className="hidden lg:flex min-h-screen flex-col justify-between bg-[#101820] px-12 py-10 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Moinhos de Vento</h1>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-slate-400">Auxiliadora Predial</p>
              {isNonProduction && (
                <span className="rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                  {environmentLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />
            Acesso interno autorizado
          </div>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Gestao financeira e fiscal em ambiente controlado.
          </h2>
          <p className="mt-5 text-sm leading-6 text-slate-300">
            Operacao de receitas, despesas, comissoes, importacao DW e emissao de
            notas fiscais com rastreabilidade e controles de acesso.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="font-semibold text-slate-200">NFS-e</p>
            <p className="mt-1">Fluxo fiscal protegido</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="font-semibold text-slate-200">DW</p>
            <p className="mt-1">Importacao validada</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="font-semibold text-slate-200">Auditoria</p>
            <p className="mt-1">Acesso tecnico restrito</p>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-950">Moinhos de Vento</h1>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xs text-slate-500">Gestao Financeira</p>
                {isNonProduction && (
                  <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    {environmentLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="mb-7">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {isNonProduction ? `Ambiente de ${environmentName}` : "Sistema interno"}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Entrar na plataforma
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {isNonProduction
                  ? "Use este ambiente apenas para validacao antes da producao."
                  : "Informe suas credenciais corporativas."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder="email@empresa.com"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Senha
                  </label>
                  <span className="text-xs text-slate-400">Acesso restrito</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Digite sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Moinhos de Vento - Gestao Financeira v1.0
          </p>
        </div>
      </section>
    </main>
  );
}
