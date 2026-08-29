import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.resolve(here, "../../data/chinook.sqlite");

export function connect(dbPath: string = DB_PATH): Database.Database {
  // readonly + fileMustExist: the agent can never mutate or create databases.
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}
