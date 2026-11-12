import { describe, expect, it } from "vitest";
import { parseEvent } from "./events";

describe("события воронки", () => {
  it("принимает известное событие и чистит свойства", () => {
    const event = parseEvent({
      name: "capsule_test",
      locale: "ru",
      ref: "reddit",
      props: { asset: "small", errors: 1, manual: false, "bad key": "x", nested: { a: 1 }, long: "y".repeat(100) },
    });
    expect(event).toEqual({
      name: "capsule_test",
      locale: "ru",
      ref: "reddit",
      props: JSON.stringify({ asset: "small", errors: 1, manual: false, long: "y".repeat(64) }),
    });
  });

  it("неизвестное имя и мусор не пишем", () => {
    expect(parseEvent({ name: "order_paid", locale: "en" })).toBeNull();
    expect(parseEvent("capsule_test")).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });

  it("странный источник отбрасываем, язык по умолчанию — en", () => {
    expect(parseEvent({ name: "capsule_test", locale: "de", ref: "<script>" })).toMatchObject({
      locale: "en",
      ref: null,
    });
  });
});
