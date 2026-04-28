type AppEnvironment = "production" | "homologacao" | "local";

const rawEnvironment = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
const normalizedEnvironment =
  rawEnvironment === "homolog" || rawEnvironment === "hml" ? "homologacao" : rawEnvironment;

export const appEnvironment: AppEnvironment =
  normalizedEnvironment === "production" ||
  normalizedEnvironment === "homologacao" ||
  normalizedEnvironment === "local"
    ? normalizedEnvironment
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
