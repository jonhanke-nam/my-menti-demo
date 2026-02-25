import dotenv from "dotenv";
dotenv.config();

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import path from "path";

const migrationsFolder = path.resolve(__dirname, "../../drizzle");

migrate(db, { migrationsFolder });
console.log("Migrations complete.");
