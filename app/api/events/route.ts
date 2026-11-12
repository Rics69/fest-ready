import { NextResponse, type NextRequest } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { parseEvent } from "@/lib/events";

/**
 * События воронки → таблица events в D1. Принимаем только со своего сайта:
 * у sendBeacon и fetch из браузера есть заголовок Origin.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new NextResponse(null, { status: 403 });
  }

  const text = await request.text().catch(() => "");
  if (text.length > 2048) return new NextResponse(null, { status: 413 });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const event = parseEvent(raw);
  if (!event) return new NextResponse(null, { status: 400 });

  const db = await getDb();
  await db
    .prepare("INSERT INTO events (name, locale, ref, props, ts) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(event.name, event.locale, event.ref, event.props, nowIso())
    .run();

  return new NextResponse(null, { status: 204 });
}
