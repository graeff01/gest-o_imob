type AppEnvironment = "production" | "homologacao" | "local";

const rawEnvironment = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();

export const appEnvironment: AppEnvironment =
  rawEnvironment === "production" || rawEnvironment === "homologacao" || rawEnvironment === "local"
    ? rawEnvironment
    : "production";

export const isNonProduction = appEnvironment !== "production";

export const environmentLabel =
  appEnvironment === "homologacao" ? "HML" : appEnvironment === "local" ? "LOCAL" : "PRD";

export const environmentName =
  appEnvironment === "homologacao"
    ? "Homologacao"
    : appEnvironment === "local"
      ? "Local"
      : "Producao";
