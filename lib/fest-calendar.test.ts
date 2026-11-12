import { describe, expect, it } from "vitest";
import { daysUntil, nextOpenFest } from "./fest-calendar";

const at = (iso: string) => {
  const [date, time = "12:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

describe("календарь Next Fest", () => {
  it("12 ноября ближайший открытый фестиваль — февраль 2027", () => {
    expect(nextOpenFest(at("2026-11-12"))?.id).toBe("2027-02");
  });

  it("после 10 января у июньского фестиваля ещё нет даты регистрации", () => {
    expect(nextOpenFest(at("2027-01-11"))).toBeNull();
  });

  it("считает дни до конца дня дедлайна", () => {
    expect(daysUntil("2027-01-10", at("2026-11-12"))).toBe(59);
    expect(daysUntil("2027-01-10", at("2027-01-09T23:00"))).toBe(1);
    expect(daysUntil("2027-01-10", at("2027-01-10T08:00"))).toBe(0);
    expect(daysUntil("2027-01-10", at("2027-01-11T08:00"))).toBe(-1);
  });
});
