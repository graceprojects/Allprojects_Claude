#!/usr/bin/env node
/* Пересчёт каталога готовых габаритов: для каждого бокса подбирает максимальную программу без потерь и запекает результат в src/office-kb.js (KB.PRESET_FIT).
 *   node tools/presets.js            — все боксы (≈ 3–5 минут)
 *   node tools/presets.js l40x12     — один (остальные сохраняются) */
const fs = require("fs"), path = require("path"), SRC = path.join(__dirname, "..", "src", "office-kb.js"), KB = require(SRC);
const only = process.argv[2], out = Object.assign({}, KB.PRESET_FIT || {});
for (const p of KB.PRESETS) { if (only && p.key !== only) continue; const t = Date.now(); const f = KB.presetFit(p);
  out[p.key] = { M: f.M, level: f.level, score: f.score, lost: f.lost, summary: KB.presetSummary(f.brief), scenario: f.variant.scenario, w: f.variant.project.b.w, d: f.variant.project.b.d };
  console.error(`${p.key.padEnd(8)} ${p.w}×${p.d} ${p.upper.padEnd(5)} M=${f.M} lvl=${f.level} score=${f.score} lost=${f.lost.length}${f.ok ? "" : " (с потерями: " + f.lost.join("; ") + ")"} ${Date.now() - t} ms`); }
let src = fs.readFileSync(SRC, "utf8");
src = src.replace(/\/\*PRESET_FIT\*\/[\s\S]*?\/\*END_PRESET_FIT\*\//, "/*PRESET_FIT*/ KB.PRESET_FIT = " + JSON.stringify(out) + "; /*END_PRESET_FIT*/");
fs.writeFileSync(SRC, src); console.error("записано в src/office-kb.js");
