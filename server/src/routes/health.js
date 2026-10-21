import { Router } from "express";
import { checkDb } from "../db.js";
import { isJwtConfigured } from "../config.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const db = await checkDb();
  const status = db.ok ? 200 : 503;

  res.status(status).json({
    ok: db.ok,
    service: "black-house-api",
    timestamp: new Date().toISOString(),
    db,
    jwtConfigured: isJwtConfigured,
  });
});

export default router;
