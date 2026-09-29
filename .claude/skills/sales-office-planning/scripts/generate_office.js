#!/usr/bin/env node
/* Генератор офиса продаж → файл проекта для «Планировщика офиса продаж».
 *
 *   node generate_office.js --level S|M|L --w 32 --d 14 --h 6.5            (ГЛАВНОЕ: размеры + вариант наполнения → автозонирование)
 *   node generate_office.js --variants --w 32 --d 14 --h 6.5              (сравнить три варианта, файл не пишет)
 *   node generate_office.js --pkg S|M|L --area 280 [--w 25 --d 12 --h 4.5]      (пакет по площади, старый генератор)
 *   node generate_office.js --w 40 --d 12 --h 7 --M 6 --B 6 [--maket 5x3] [--mezz auto|yes|no]
 *        [--kids 1] [--cafe 1] [--wardrobe 1] [--bank 1] [--cashier 0] [--media 0] [--showroom 0] [--director 1]
 *        [--name "Офис продаж ЖК …"] [--out office.json] [--json '{"w":40,…}']
 *
 * Печатает в stderr сводку (программа цель/факт, проверки, предупреждения), JSON проекта — в --out или stdout.
 * Файл открывается в планировщике: «Проекты» → «Открыть файл…».
 */
const fs = require("fs"), path = require("path");
const KB = require(path.join(__dirname, "office-kb.js"));
const a = process.argv.slice(2), p = {};
for (let i = 0; i < a.length; i++) {
  if (!a[i].startsWith("--")) continue;
  const k = a[i].slice(2), v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : "1";
  if (k === "json") Object.assign(p, JSON.parse(v));
  else p[k] = v;
}
const bool = ["kids", "cafe", "wardrobe", "bank", "cashier", "media", "showroom", "director"];
const num = ["w", "d", "h", "M", "B", "area"];
for (const k of bool) if (k in p && typeof p[k] === "string") p[k] = !["0", "false", "no", "нет"].includes(p[k].toLowerCase());
for (const k of num) if (k in p) p[k] = +String(p[k]).replace(",", ".");
const out = p.out; delete p.out;
if (p.pkg) { p.pkg = String(p.pkg).toUpperCase(); if (!KB.PACKAGES[p.pkg]) { console.error("Пакет: S, M или L"); process.exit(1); }
  p.area = p.area || KB.PACKAGES[p.pkg].A; const b = KB.suggestBuilding(p.pkg, p.area); for (const k of ["w", "d", "h"]) if (!(k in p)) p[k] = b[k];
  const pp = KB.packageProgram(p.pkg, p.area, p.opts || {}, p.counts || {});
  process.stderr.write(`Пакет «${KB.PACKAGES[p.pkg].name}» ${p.area} м²: M=${pp.vars.M}, B=${pp.vars.B}, мест ожидания ${pp.vars.seats}; помещения ${pp.net} м² × ${pp.k} = ${pp.need} м²; здание ${p.w}×${p.d}×${p.h}\n`); }
if (p.variants) { for (const r of KB.variants({ w: p.w, d: p.d, h: p.h || 4.5, mezz: p.mezz || "auto" })) process.stdout.write(`${r.brief}${r.missing.length ? " Не поместилось: " + r.missing.join(", ") + "." : ""}\n  решения: ${r.log.join("; ") || "без изменений"}\n\n`); process.exit(0); }
if (p.level) { const r = KB.autoPlan({ pkg: String(p.level).toUpperCase(), w: p.w, d: p.d, h: p.h || 4.5, mezz: p.mezz || "auto", name: p.name });
  process.stderr.write(r.brief + "\n" + (r.log.length ? "Решения движка:\n  - " + r.log.join("\n  - ") + "\n" : "") + KB.summary(r.project) + "\n");
  const json = JSON.stringify(r.project, null, 1); if (out) { fs.writeFileSync(out, json); process.stderr.write(`Файл проекта: ${out}\n`); } else process.stdout.write(json); process.exit(0); }
const fit = KB.fit(p);
const r = KB.generate(p);
process.stderr.write(`Вмещается: нужно ≈ ${fit.need} м² (${fit.net} × ${fit.k}), есть ${fit.have} м² → ${fit.ratio >= 1 ? "да" : "НЕТ"}\n`);
process.stderr.write(KB.summary(r.project) + "\n");
if (r.warnings.length) process.stderr.write("Предупреждения:\n  - " + r.warnings.join("\n  - ") + "\n");
const json = JSON.stringify(r.project, null, 1);
if (out) { fs.writeFileSync(out, json); process.stderr.write(`Файл проекта: ${out}\n`); } else process.stdout.write(json);
