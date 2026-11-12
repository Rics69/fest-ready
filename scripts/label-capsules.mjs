/**
 * Разметка капсул для калибровки: локальная страница на http://localhost:4400 (только на этой машине).
 * Показывает капсулы из fixtures/unlabeled/ в 462×174 и в размерах Steam; клавиши 1–4 ставят метку,
 * размеченная капсула копируется в fixtures/manual/<appId>.<метка>.jpg — её подхватит `npm run calibrate`.
 *
 * Запуск: npm run capsules:label (сначала npm run capsules:collect).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const ROOT = process.cwd();
const UNLABELED = join(ROOT, "fixtures/unlabeled");
const MANUAL = join(ROOT, "fixtures/manual");
const LABELS = join(ROOT, "fixtures/labels.json");
const PORT = Number(process.env.PORT ?? 4400);
const KINDS = ["ok", "unreadable", "text", "contrast", "skip"];

mkdirSync(MANUAL, { recursive: true });
if (!existsSync(join(UNLABELED, "index.json"))) {
  console.error("Нет fixtures/unlabeled/index.json — сначала npm run capsules:collect");
  process.exit(1);
}

const index = JSON.parse(readFileSync(join(UNLABELED, "index.json"), "utf8"));
const labels = existsSync(LABELS) ? JSON.parse(readFileSync(LABELS, "utf8")) : {};
const save = () => writeFileSync(LABELS, JSON.stringify(labels, null, 2));

function state() {
  const queue = index.filter((e) => !(e.appId in labels));
  const counts = Object.fromEntries(KINDS.map((k) => [k, Object.values(labels).filter((v) => v === k).length]));
  return { queue, total: index.length, done: index.length - queue.length, counts };
}

function label(appId, kind) {
  const entry = index.find((e) => e.appId === appId);
  if (!entry || !KINDS.includes(kind)) return false;
  unlabel(appId);
  labels[appId] = kind;
  if (kind !== "skip") copyFileSync(join(UNLABELED, `${appId}.jpg`), join(MANUAL, `${appId}.${kind}.jpg`));
  save();
  return true;
}

function unlabel(appId) {
  const previous = labels[appId];
  if (previous && previous !== "skip") rmSync(join(MANUAL, `${appId}.${previous}.jpg`), { force: true });
  delete labels[appId];
  save();
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

const send = (res, status, type, data) => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(data);
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, "text/html; charset=utf-8", PAGE);
    if (req.method === "GET" && url.pathname === "/api/state")
      return send(res, 200, "application/json", JSON.stringify(state()));
    const img = url.pathname.match(/^\/img\/(\d+)\.jpg$/);
    if (req.method === "GET" && img) {
      const file = join(UNLABELED, `${img[1]}.jpg`);
      if (!existsSync(file)) return send(res, 404, "text/plain", "not found");
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "max-age=3600" });
      return res.end(readFileSync(file));
    }
    if (req.method === "POST" && url.pathname === "/api/label") {
      const { appId, kind } = await body(req);
      return send(res, label(Number(appId), kind) ? 200 : 400, "application/json", JSON.stringify(state()));
    }
    if (req.method === "POST" && url.pathname === "/api/undo") {
      const { appId } = await body(req);
      unlabel(Number(appId));
      return send(res, 200, "application/json", JSON.stringify(state()));
    }
    send(res, 404, "text/plain", "not found");
  } catch (error) {
    send(res, 500, "text/plain", String(error));
  }
}).listen(PORT, "127.0.0.1", () => {
  const { total, done } = state();
  console.log(`Разметка капсул: http://localhost:${PORT} — размечено ${done} из ${total}`);
});

const PAGE = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Разметка капсул — FestReady</title>
<style>
  :root { --bg:#0b0c0f; --surface:#121419; --raised:#181b21; --fg:#eceef2; --muted:#9097a3; --subtle:#5d6470;
    --border:#22262e; --border-strong:#323843; --accent:#a798ff; --ok:#4ade80; --warn:#fbbf24; --stop:#f87171;
    --ease-out:cubic-bezier(0.23,1,0.32,1); color-scheme:dark; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:1040px; margin:0 auto; padding:32px 16px 64px; }
  h1 { font-size:20px; margin:0; letter-spacing:-0.01em; }
  .muted { color:var(--muted); } .subtle { color:var(--subtle); } .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
  .bar { height:4px; background:var(--border); border-radius:4px; margin:16px 0 28px; overflow:hidden; }
  .bar > span { display:block; height:100%; background:var(--accent); transform-origin:left; transition:transform 200ms var(--ease-out); }
  .stage { display:grid; gap:24px; grid-template-columns:minmax(0,462px) minmax(0,1fr); align-items:start; }
  @media (max-width:860px) { .stage { grid-template-columns:1fr; } }
  .big { width:100%; max-width:462px; aspect-ratio:462/174; display:block; border-radius:4px; outline:1px solid var(--border-strong); background:var(--surface); object-fit:cover; }
  .steam { background:#11151c; border:1px solid var(--border); border-radius:12px; padding:20px; }
  .sizes { display:flex; flex-wrap:wrap; gap:20px 28px; align-items:flex-end; margin-top:16px; }
  .sizes img { display:block; border-radius:3px; object-fit:cover; }
  .meta { margin-top:10px; display:flex; flex-wrap:wrap; gap:6px 14px; }
  .keys { display:grid; gap:10px; grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:28px; }
  @media (max-width:640px) { .keys { grid-template-columns:1fr; } }
  button { all:unset; box-sizing:border-box; cursor:pointer; border:1px solid var(--border-strong); border-radius:10px; padding:12px 14px;
    background:var(--surface); transition:transform 160ms var(--ease-out), border-color 160ms ease, background-color 160ms ease; }
  button:active { transform:scale(0.97); }
  @media (hover:hover) and (pointer:fine) { button:hover { border-color:var(--subtle); } }
  button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .k { display:inline-grid; place-items:center; width:22px; height:22px; border-radius:6px; background:var(--raised); font:600 12px ui-monospace,monospace; margin-right:8px; }
  .title { font-weight:600; } .hint { display:block; margin-top:4px; font-size:13px; color:var(--muted); }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-left:6px; vertical-align:middle; }
  .row { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
  .row button { padding:8px 12px; font-size:14px; }
  .counts { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:6px; }
  .done { padding:40px 0; }
  @media (prefers-reduced-motion:reduce) { .bar > span, button { transition:none; } }
</style>
</head>
<body>
<main>
  <h1>Разметка капсул для калибровки</h1>
  <p class="muted" id="progress">Загрузка…</p>
  <div class="counts mono subtle" id="counts"></div>
  <div class="bar"><span id="bar" style="transform:scaleX(0)"></span></div>
  <section id="app"></section>
</main>
<script>
const KINDS = [
  { key: "1", kind: "ok", title: "Нормальная", hint: "В 120×45 название читается, текста кроме названия нет", color: "var(--ok)" },
  { key: "2", kind: "unreadable", title: "Нечитаемая", hint: "В 120×45 название не прочитать: мелкое, тонкое, теряется в арте", color: "var(--warn)" },
  { key: "3", kind: "text", title: "Лишний текст", hint: "Кроме названия: оценки, награды, скидки, Wishlist, Demo, Early Access. Ставьте 3, даже если название тоже плохое", color: "var(--stop)" },
  { key: "4", kind: "contrast", title: "Низкий контраст", hint: "Название разбирается вблизи, но плохо отделяется от фона", color: "var(--accent)" },
];
let state = null;
let history = [];
const $ = (id) => document.getElementById(id);

async function call(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  return res.json();
}

function render() {
  const { queue, total, done, counts } = state;
  $("progress").textContent = queue.length ? "Размечено " + done + " из " + total + " · клавиши 1–4, 0 — пропустить, ← — назад" : "Размечено " + done + " из " + total;
  $("counts").textContent = KINDS.map((k) => k.title + ": " + (counts[k.kind] || 0)).join("   ") + "   Пропущено: " + (counts.skip || 0);
  $("bar").style.transform = "scaleX(" + (total ? done / total : 0) + ")";
  const app = $("app");
  if (!queue.length) {
    app.innerHTML = '<div class="done"><p class="title">Готово.</p><p class="muted">Размеченные капсулы лежат в fixtures/manual/. Запустите <span class="mono">npm run calibrate</span> — в конце будет сводка по меткам.</p>' +
      (history.length ? '<div class="row"><button id="undo">← Назад к последней</button></div>' : "") + "</div>";
    if (history.length) $("undo").onclick = undo;
    return;
  }
  const item = queue[0];
  const src = "/img/" + item.appId + ".jpg";
  const sizes = [[231, 87], [184, 69], [120, 45]];
  app.innerHTML =
    '<div class="stage">' +
      "<div><img class=\\"big\\" src=\\"" + src + "\\" alt=\\"\\">" +
        '<div class="meta mono subtle"><span>' + escapeHtml(item.name) + "</span><span>" + item.source + "</span>" +
        (item.released ? "<span>" + item.released + "</span>" : "") + (item.legacy ? "<span>старая 467×181</span>" : "") +
        (item.override ? "<span>временная обложка</span>" : "") + "</div></div>" +
      '<div class="steam"><span class="muted">Так её видят в Steam</span><div class="sizes">' +
        sizes.map(([w, h]) => '<div><img src="' + src + '" width="' + w + '" height="' + h + '" style="width:' + w + "px;height:" + h + 'px" alt=""><span class="mono subtle">' + w + "×" + h + "</span></div>").join("") +
      "</div></div>" +
    "</div>" +
    '<div class="keys">' + KINDS.map((k) => '<button data-kind="' + k.kind + '"><span class="k">' + k.key + '</span><span class="title">' + k.title + '</span><span class="dot" style="background:' + k.color + '"></span><span class="hint">' + k.hint + "</span></button>").join("") + "</div>" +
    '<div class="row"><button data-kind="skip"><span class="k">0</span>Пропустить</button>' + (history.length ? '<button id="undo"><span class="k">←</span>Назад</button>' : "") + "</div>";
  app.querySelectorAll("button[data-kind]").forEach((b) => (b.onclick = () => mark(b.dataset.kind)));
  if (history.length) $("undo").onclick = undo;
  if (queue[1]) new Image().src = "/img/" + queue[1].appId + ".jpg";
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

async function mark(kind) {
  const item = state.queue[0];
  if (!item) return;
  history.push(item.appId);
  state = await call("/api/label", { appId: item.appId, kind });
  render();
}

async function undo() {
  const appId = history.pop();
  if (!appId) return;
  state = await call("/api/undo", { appId });
  render();
}

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KINDS.find((x) => x.key === e.key);
  if (k) mark(k.kind);
  else if (e.key === "0" || e.key === " ") { e.preventDefault(); mark("skip"); }
  else if (e.key === "ArrowLeft" || e.key === "Backspace") { e.preventDefault(); undo(); }
});

call("/api/state").then((s) => { state = s; render(); });
</script>
</body>
</html>`;
