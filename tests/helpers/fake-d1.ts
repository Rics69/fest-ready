import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * D1 для тестов поверх встроенного SQLite Node.js: те же SQL-миграции, тот же синтаксис ?1, ?2.
 * Реализует только то, чем пользуется код: prepare().bind().run() / first() / all().
 */
export function fakeD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  const dir = join(process.cwd(), "db", "migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(join(dir, file), "utf8"));
  }

  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    run: async () => {
      const info = sqlite.prepare(sql).run(...(params as never[]));
      return { success: true, meta: { changes: Number(info.changes) } };
    },
    first: async () => (sqlite.prepare(sql).get(...(params as never[])) ?? null) as never,
    all: async () => ({ success: true, results: sqlite.prepare(sql).all(...(params as never[])) }) as never,
  });

  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}
