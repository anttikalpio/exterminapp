import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import * as relations from "../../drizzle/relations";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema: { ...schema, ...relations } });
