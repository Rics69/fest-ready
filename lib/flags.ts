/**
 * Флаги функций. Задаются при сборке (NEXT_PUBLIC_*), чтобы сервер и браузер видели одно значение.
 * Незаданный флаг: в разработке — включён (оплата на заглушке), в продакшн-сборке — выключен.
 * Так запуск не зависит от того, готовы ли касса и бенчмарки.
 */

/**
 *   mock     — тестовая касса на своём сайте, деньги не списываются
 *   rollypay — настоящая касса RollyPay (нужны ключи)
 *   off      — кнопки оплаты ведут в лист ожидания
 */
export type PaymentsMode = "mock" | "rollypay" | "off";

const isProduction = () => process.env.NODE_ENV === "production";

function onOff(value: string | undefined): boolean {
  if (value === "on") return true;
  if (value === "off") return false;
  return !isProduction();
}

export function paymentsMode(): PaymentsMode {
  const value = process.env.NEXT_PUBLIC_PAYMENTS_MODE;
  if (value === "mock" || value === "rollypay" || value === "off") return value;
  return isProduction() ? "off" : "mock";
}

/**
 * Платный прогноз. Даже включённый флаг не запустит расчёт, пока в data/benchmarks.json
 * есть пустые корзины (проверка появится вместе с движком прогноза в фазе 4).
 */
export function forecastEnabled(): boolean {
  return onOff(process.env.NEXT_PUBLIC_FORECAST);
}

/** Экспорт набора Capsule Kit в полном разрешении. */
export function kitExportEnabled(): boolean {
  return onOff(process.env.NEXT_PUBLIC_KIT_EXPORT);
}
