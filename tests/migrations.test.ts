import { describe, expect, it } from "vitest";
import { fakeD1 } from "./helpers/fake-d1";

describe("миграции D1", () => {
  it("создают все таблицы из плана MVP", async () => {
    const db = fakeD1();
    const { results } = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "events",
      "forecasts",
      "orders",
      "payment_events",
      "reminders",
      "steam_cache",
      "waitlist",
    ]);
  });

  it("повтор колбэка с тем же статусом не создаёт вторую запись", async () => {
    const db = fakeD1();
    const insert =
      "INSERT OR IGNORE INTO payment_events (payment_id, status, received_at, raw) VALUES (?1, ?2, ?3, ?4)";
    await db.prepare(insert).bind("p1", "paid", "2026-11-12T00:00:00.000Z", "{}").run();
    await db.prepare(insert).bind("p1", "paid", "2026-11-12T00:00:01.000Z", "{}").run();
    const row = await db.prepare("SELECT COUNT(*) AS n FROM payment_events").first<{ n: number }>();
    expect(row?.n).toBe(1);
  });
});
