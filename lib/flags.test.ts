import { afterEach, describe, expect, it, vi } from "vitest";
import { forecastEnabled, kitExportEnabled, paymentsMode } from "./flags";

afterEach(() => vi.unstubAllEnvs());

describe("флаги", () => {
  it("в разработке без настроек: заглушка оплаты, прогноз и экспорт включены", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(paymentsMode()).toBe("mock");
    expect(forecastEnabled()).toBe(true);
    expect(kitExportEnabled()).toBe(true);
  });

  it("в продакшне без настроек всё платное выключено", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(paymentsMode()).toBe("off");
    expect(forecastEnabled()).toBe(false);
    expect(kitExportEnabled()).toBe(false);
  });

  it("явные значения важнее окружения", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PAYMENTS_MODE", "rollypay");
    vi.stubEnv("NEXT_PUBLIC_FORECAST", "on");
    vi.stubEnv("NEXT_PUBLIC_KIT_EXPORT", "on");
    expect(paymentsMode()).toBe("rollypay");
    expect(forecastEnabled()).toBe(true);
    expect(kitExportEnabled()).toBe(true);
  });

  it("неизвестный режим оплаты считается незаданным", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PAYMENTS_MODE", "stripe");
    expect(paymentsMode()).toBe("off");
  });
});
