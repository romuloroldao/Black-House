import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

function required(name, { allowEmpty = false } = {}) {
  const value = process.env[name];
  if (!allowEmpty && (value === undefined || value === "")) {
    return null;
  }
  return value ?? null;
}

export const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: required("JWT_SECRET") || "dev-only-insecure-jwt-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "blackhouse_db",
    user: process.env.DB_USER || "app_user",
    password: process.env.DB_PASSWORD || "",
  },
  lovableApiKey: process.env.LOVABLE_API_KEY || "",
};

export const isJwtConfigured =
  Boolean(process.env.JWT_SECRET) &&
  process.env.JWT_SECRET.length >= 16 &&
  process.env.JWT_SECRET !== "troque-esta-chave-por-uma-secreta-de-32plus-chars";
