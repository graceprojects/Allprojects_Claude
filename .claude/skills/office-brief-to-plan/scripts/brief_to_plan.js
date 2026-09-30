#!/usr/bin/env node
/* ТЗ заказчика (brief.json) → план офиса продаж для houz planner.
 *
 *   node brief_to_plan.js brief.json --out plan.json [--sheet plan.png] [--sets]
 *
 * brief.json — состав помещений по опроснику (формат: references/brief-format.md).
 * Вся логика — в ядре планировщика: KB.fromBrief (то же, что собирает мастер «Новый проект» по галочкам).
 * Ядро превращает ТЗ в «пакет наполнения» для движка зонирования (KB.autoPlan), собирает план, подгоняет мебель
 * под ТЗ (стойка ресепшен, стол переговорной), доразмещает то, что движок уронил, и пишет отчёт:
 * здание и допущения, программа цель/факт, что движок изменил и почему, проверки норм.
 */
const fs = require("fs"), path = require("path");
const KB = require(path.join(__dirname, "office-kb.js"));

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const file = args.find(a => !a.startsWith("--") && !["--out", "--sheet"].some(k => args[args.indexOf(a) - 1] === k));
if (!file) { console.error("node brief_to_plan.js brief.json --out plan.json [--sheet plan.png] [--sets]"); process.exit(1); }
const B = JSON.parse(fs.readFileSync(file, "utf8"));
const out = opt("--out") || file.replace(/\.json$/, "") + ".plan.json";
if (args.includes("--sets")) B.sets = true;   // обставить помещения готовыми наборами — мебели больше и она «представительнее»

let r;
try { r = KB.fromBrief(B); }
catch (e) { console.error(e.message + " — спросите заказчика."); process.exit(2); }
fs.writeFileSync(out, JSON.stringify(r.project));
console.log(r.report + `\n\nФайл проекта: ${out}`);

if (opt("--sheet")) {
  const rs = require(path.join(__dirname, "render_sheet.js"));
  rs.render(out, opt("--sheet")).then(p => console.log(`Лист «план + изометрия»: ${p}`)).catch(e => console.log(`Лист не отрисован: ${e.message}`));
}
