/**
 * Раздаём распознавание текста со своего домена, а не с CDN tesseract.js:
 * не зависим от чужого CDN, и о тесте капсулы не узнаёт никто, кроме нас.
 * Копирует в public/vendor/tesseract/ (в git не попадает) воркер, ядро WebAssembly и модели EN и RU.
 * Запускается само перед `npm run dev` и `npm run build`.
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/vendor/tesseract");
const modules = join(ROOT, "node_modules");

mkdirSync(join(OUT, "core"), { recursive: true });
mkdirSync(join(OUT, "lang"), { recursive: true });

copyFileSync(join(modules, "tesseract.js/dist/worker.min.js"), join(OUT, "worker.min.js"));

// Сборки ядра только для LSTM (мы создаём воркер с OEM 1): tesseract.js сам выбирает подходящую браузеру
// (обычная, SIMD, relaxed SIMD), скачивается одна.
const core = join(modules, "tesseract.js-core");
const coreFiles = readdirSync(core).filter((f) => f.endsWith("-lstm.wasm.js"));
for (const f of coreFiles) copyFileSync(join(core, f), join(OUT, "core", f));

for (const lang of ["eng", "rus"]) {
  copyFileSync(
    join(modules, `@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`),
    join(OUT, "lang", `${lang}.traineddata.gz`),
  );
}

console.log(`copy-tesseract: воркер, ${coreFiles.length} сборок ядра и модели eng, rus → public/vendor/tesseract`);
