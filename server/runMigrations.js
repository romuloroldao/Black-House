import fs from "fs";
import path from "path";
import pkg from "pg";

const { Client } = pkg;

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

await client.connect();

// const schemaPath = path.resolve("../migration/migration_postgres.sql");
const schemaPath = path.resolve("../schema_adaptado_postgres.sql");

console.log(`➡️ Rodando ${schemaPath}`);

const sql = fs.readFileSync(schemaPath, "utf8");

try {
  await client.query(sql);
  console.log("✅ Schema aplicado com sucesso");
} catch (err) {
  console.error("❌ Erro ao aplicar schema");
  console.error(err.message);
  process.exit(1);
}

await client.end();