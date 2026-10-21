import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { pool } from "../db.js";

/**
 * Bearer JWT → req.user + req.authToken
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = decoded.userId || decoded.sub;
    if (!userId) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const result = await pool.query(
      `SELECT id, email, created_at, last_sign_in_at, raw_user_meta_data
       FROM app_auth.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    let role = null;
    try {
      const roleResult = await pool.query(
        `SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      role = roleResult.rows[0]?.role ?? null;
    } catch {
      // user_roles pode não existir ainda no dump antigo
    }

    req.user = { ...result.rows[0], role };
    req.authToken = token;
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
