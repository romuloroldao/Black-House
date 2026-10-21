import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config, isJwtConfigured } from "./config.js";
import { checkDb } from "./db.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import colemanRouter from "./routes/coleman.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.use(healthRouter);
app.use(authRouter);
app.use(colemanRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use((err, _req, res, _next) => {
  console.error("[api]", err);
  res.status(500).json({ error: "Erro interno" });
});

async function boot() {
  const db = await checkDb();

  if (!isJwtConfigured) {
    console.warn(
      "[boot] JWT_SECRET fraco ou ausente — configure server/.env antes de produção"
    );
  }

  if (!db.ok) {
    console.warn(
      `[boot] Postgres indisponível (${db.error}). /health retornará 503 até a VPS conectar.`
    );
  } else {
    console.log(`[boot] Postgres OK (${db.latencyMs}ms)`);
  }

  app.listen(config.port, () => {
    console.log(
      `black-house-api em http://127.0.0.1:${config.port} (env=${config.nodeEnv})`
    );
  });
}

boot().catch((err) => {
  console.error("[boot] fatal:", err);
  process.exit(1);
});
