import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db.js";
import { config } from "../config.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
});

function signAccessToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

async function fetchUserPublic(userId) {
  const userResult = await pool.query(
    `SELECT id, email, created_at, last_sign_in_at
     FROM app_auth.users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return null;

  let role = null;
  try {
    const roleResult = await pool.query(
      `SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    role = roleResult.rows[0]?.role ?? null;
  } catch {
    // opcional
  }

  return { ...user, role };
}

router.post("/auth/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email/senha inválidos", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const role = req.body?.role === "aluno" ? "aluno" : "coach";

  try {
    const result = await pool.query(`SELECT app_auth.create_user($1, $2)`, [
      email,
      password,
    ]);
    const userId = result.rows[0].create_user;

    try {
      await pool.query(
        `INSERT INTO public.user_roles (user_id, role)
         VALUES ($1, $2::public.user_role)
         ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`,
        [userId, role]
      );
    } catch (roleErr) {
      console.warn("[auth/signup] user_roles:", roleErr.message);
    }

    const token = signAccessToken(userId);
    const user = await fetchUserPublic(userId);
    return res.status(201).json({ user, token });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "Email já cadastrado" });
    }
    console.error("[auth/signup]", error.message);
    return res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email/senha inválidos" });
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(`SELECT * FROM app_auth.login($1, $2)`, [
      email,
      password,
    ]);

    if (!result.rows.length) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const { user_id: userId } = result.rows[0];
    const token = signAccessToken(userId);
    const user = await fetchUserPublic(userId);
    return res.json({ user, token });
  } catch (error) {
    const msg = error.message || "";
    if (/credenciais|senha|usuário/i.test(msg)) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    console.error("[auth/login]", msg);
    return res.status(500).json({ error: "Erro ao autenticar" });
  }
});

router.get("/auth/me", authenticate, async (req, res) => {
  const { id, email, created_at, last_sign_in_at, role } = req.user;
  return res.json({
    user: { id, email, created_at, last_sign_in_at, role },
  });
});

/** Alias compatível com o guia legado */
router.get("/auth/user", authenticate, async (req, res) => {
  const { id, email, created_at, last_sign_in_at, role } = req.user;
  return res.json({
    user: { id, email, created_at, last_sign_in_at, role },
  });
});

router.post("/auth/logout", authenticate, async (req, res) => {
  try {
    // Invalida sessão DB se o client mandar o session_token separado;
    // JWT em si expira sozinho. Melhor esforço com token JWT id não é o session token.
    const sessionToken = req.body?.sessionToken;
    if (sessionToken) {
      await pool.query(`SELECT app_auth.logout($1)`, [sessionToken]);
    }
  } catch (error) {
    console.warn("[auth/logout]", error.message);
  }
  return res.json({ message: "Logout realizado" });
});

export default router;
