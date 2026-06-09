import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const database = new DatabaseSync("prisma/dev.db");
database.exec("PRAGMA foreign_keys = ON;");
database.exec(readFileSync("prisma/migrations/20260608150000_init/migration.sql", "utf8"));
database.exec(readFileSync("prisma/migrations/20260608194500_card_stage_connections/migration.sql", "utf8"));
database.exec(readFileSync("prisma/migrations/20260608203000_kanban_stage_transitions/migration.sql", "utf8"));
database.close();
console.log("SQLite schema initialized.");
