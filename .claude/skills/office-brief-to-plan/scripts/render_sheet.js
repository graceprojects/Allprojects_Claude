#!/usr/bin/env node
/* Лист «план 2D + изометрия» (PNG) из файла проекта — рисует сам houz planner в headless-браузере.
 *
 *   node render_sheet.js plan.json plan.png [--planner путь/к/планировщику.html]
 *
 * Планировщик ищется так: --planner → переменная HOUZ_PLANNER → office-planner/ в репозитории
 * (Планировщик-офиса.html или site/index.html — оба самодостаточные) → сайт GitHub Pages.
 * Нужен Playwright + Chromium. Нет браузера — не страшно: план всё равно в plan.json,
 * а текстовую схему даёт `node -e "KB.ascii(S)"` (см. SKILL.md).
 */
const fs = require("fs"), path = require("path"), os = require("os");
const SITE = "https://graceprojects.github.io/Allprojects_Claude/";

function findPlanner(explicit) {
  const c = [explicit, process.env.HOUZ_PLANNER];
  for (let dir = __dirname, i = 0; i < 8; i++, dir = path.dirname(dir))
    c.push(path.join(dir, "office-planner", "Планировщик-офиса.html"), path.join(dir, "office-planner", "site", "index.html"));
  const f = c.find(p => p && fs.existsSync(p));
  return f ? "file://" + path.resolve(f) : SITE;
}
function loadPlaywright() {
  const tries = ["playwright", "/opt/node22/lib/node_modules/playwright"];
  try { tries.push(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")); } catch (e) {}
  for (const t of tries) { try { return require(t); } catch (e) {} }
  throw new Error("нет Playwright (npm i -g playwright)");
}

async function render(planFile, outPng, plannerPath) {
  const { chromium } = loadPlaywright();
  const exe = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].find(p => p && fs.existsSync(p) && fs.statSync(p).isFile());
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const pg = await b.newPage({ viewport: { width: 1500, height: 950 } });
    const errs = []; pg.on("pageerror", e => errs.push(e.message));
    await pg.goto(findPlanner(plannerPath)); await pg.waitForTimeout(900);
    const proj = JSON.parse(fs.readFileSync(planFile, "utf8"));
    const url = await pg.evaluate(async P => {
      S = P; sel = null; level = 0; setView("2d"); fit(); render();       // глобальные переменные планировщика
      const bl = await sheetPNG(); const r = new FileReader();
      return await new Promise(ok => { r.onload = () => ok(r.result); r.readAsDataURL(bl); });
    }, proj);
    fs.writeFileSync(outPng, Buffer.from(url.split(",")[1], "base64"));
    if (errs.length) console.error("Ошибки страницы:", errs.join(" | "));
    return outPng;
  } finally { await b.close(); }
}
module.exports = { render };

if (require.main === module) {
  const a = process.argv.slice(2), i = a.indexOf("--planner"), pl = i >= 0 ? a.splice(i, 2)[1] : null;
  if (a.length < 1) { console.error("node render_sheet.js plan.json plan.png [--planner file.html]"); process.exit(1); }
  const out = a[1] || a[0].replace(/\.json$/, "") + ".png";
  render(a[0], out, pl).then(p => console.log(p)).catch(e => { console.error("Лист не отрисован: " + e.message); process.exit(3); });
}
