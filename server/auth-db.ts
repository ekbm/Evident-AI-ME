import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as authSchema from "@shared/models/auth";
import * as enterpriseSchema from "@shared/models/enterprise-agent";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for authentication");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const schema = { ...authSchema, ...enterpriseSchema };

export const db = drizzle(pool, { schema });
