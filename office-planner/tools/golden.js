#!/usr/bin/env node
/* Эталонный тест «насколько близко к живому проекту».
 *   node tools/golden.js            — все эталоны
 *   node tools/golden.js r24-060-v2 — один
 * Для каждого эталона (план houz, перенесённый в JSON) печатает его собственную оценку (KB.planScore) — калибровка правил:
 * профессиональный план не должен собирать много советов. Затем собирает план движком по ТЗ, эквивалентному программе эталона,
 * на тех же габаритах и сравнивает: доли зон, выполнение матрицы смежности, путь клиента по этапам, что не поместилось.
 */
const fs = require("fs"), path = require("path");
const KB = require(path.join(__dirname, "..", "src", "office-kb.js"));
const EX = p => path.join(__dirname, "..", "examples", p + ".json");

// ТЗ, эквивалентные программам эталонов (состав и число помещений — по экспликации)
const R24 = (w, d, extra) => Object.assign({ name: "R24 060", building: { w, d, h: 4.5, upper: "none" }, sales: { managers: 5, format: "shared" }, meet: { n: 1, seats: 10 },
  director: "room", bank: 3, cashier: true, notary: true, kids: "corner", cafe: "corner", wardrobe: "room", prayer: true, media: true, maket: "6x5",
  wc_guest: "mf", waiting: 8, kitchen: { seats: 6, type: "table" }, server: false, tambour: false }, extra || {});
const GOLD = [
  { key: "r24-060-v1", name: "R24 060 вариант 1", brief: b => R24(b.w, b.d, { bank: 0, cashier: false, notary: false, prayer: false, media: false, vip: 1, meet: 0, cafe: "bar", backoffice: 4 }) },
  { key: "r24-060-v2", name: "R24 060 вариант 2", brief: b => R24(b.w, b.d) },
  { key: "r24-060-v3", name: "R24 060 вариант 3", brief: b => R24(b.w, b.d) },
  { key: "houz-interior", name: "Альбом интерьера houz", brief: b => ({ building: { w: b.w, d: b.d, h: 8, upper: "mezz" }, sales: { managers: 8, format: "shared" }, meet: { n: 1, seats: 4 }, director: "room", cafe: "bar", maket: "6x5", wardrobe: "rack", waiting: 12 }) },
];
const GROUP = { public: ["rec", "wait", "kids", "bar", "maket", "media", "wardrobe", "entr", "showroom", "hall"], sales: ["cab", "rop", "meet"], deal: ["vip", "bank", "cash", "notary"],
  service: ["wc", "kitchen", "tech", "barback", "prayer", "back"], circ: ["circ", "other"] };
const GN = { public: "клиентская", sales: "продажи", deal: "сделка", service: "служебное", circ: "проходы" };
// доли зон по клеткам сетки: каждая клетка принадлежит наименьшему помещению, которое её накрывает (вложенные зоны не считаются дважды)
function shares(S) { const G = KB.walkGrid(S, 0), cnt = {}; let all = 0;
  for (let k = 0; k < G.mem.length; k++) { const m = G.mem[k]; if (m < 0) continue; const role = KB.roleOf(G.rooms[m]); const g = Object.keys(GROUP).find(x => GROUP[x].includes(role)) || "circ"; cnt[g] = (cnt[g] || 0) + 1; all++; }
  return Object.fromEntries(Object.keys(GROUP).map(g => [g, all ? (cnt[g] || 0) / all : 0])); }
const pct = v => Math.round(v * 100) + " %";
function stagesOf(S) { const J = KB.journey(S); return J ? Object.fromEntries(J.stages.map(s => [s.n, s.missing ? null : s.dist])) : {}; }
const only = process.argv[2];
let sumRef = 0, sumGen = 0, n = 0;
for (const g of GOLD) {
  if (only && g.key !== only) continue;
  if (!fs.existsSync(EX(g.key))) { console.log(`\n== ${g.name}: нет файла examples/${g.key}.json`); continue; }
  const ref = JSON.parse(fs.readFileSync(EX(g.key), "utf8")), b = ref.b;
  const P0 = KB.planScore(ref), A0 = KB.adjacency(ref), sh0 = shares(ref), st0 = stagesOf(ref);
  let V = []; try { V = KB.briefVariants(g.brief(b), { dims: { w: +b.w, d: +b.d } }); } catch (e) { console.log(g.name, "движок:", e.message); }
  const best = V[0], gen = best && best.project;
  const P1 = gen ? KB.planScore(gen) : null, A1 = gen ? KB.adjacency(gen) : null, sh1 = gen ? shares(gen) : {}, st1 = gen ? stagesOf(gen) : {};
  n++; sumRef += P0.score; sumGen += P1 ? P1.score : 0;
  console.log(`\n== ${g.name} · ${b.w} × ${b.d} м`);
  console.log(`  оценка: эталон ${P0.score} (советов ${P0.advice}, смежность ${P0.adj} %) | движок ${P1 ? P1.score : "—"} «${best ? best.scenario : "—"}» (советов ${P1 ? P1.advice : "—"}, смежность ${P1 ? P1.adj : "—"} %, не поместилось ${best ? best.lost.length : "—"})`);
  console.log("  доли зон:   " + Object.keys(GROUP).map(k => `${GN[k]} ${pct(sh0[k])} / ${gen ? pct(sh1[k]) : "—"}`).join(" · "));
  console.log("  путь, м:    " + KB.JOURNEY.map(s => `${s.n}.${s.label} ${st0[s.n] == null ? "—" : st0[s.n]} / ${st1[s.n] == null ? "—" : st1[s.n]}`).join(" · "));
  const adv0 = KB.designChecks(ref); if (adv0.length) console.log("  советы эталону: " + adv0.map(c => c.key).join(", "));
  if (gen) console.log("  советы движку:  " + KB.designChecks(gen).map(c => c.key).join(", ") + (best.lost.length ? ` | не поместилось: ${best.lost.join("; ")}` : ""));
  const miss = A0.pairs.filter(p => !p.ok); if (miss.length) console.log("  эталон нарушает матрицу: " + miss.map(p => `${p.a}–${p.b} ${p.dist} м`).join(", "));
}
if (n) console.log(`\nGOLDEN ${n} · эталоны ${(sumRef / n).toFixed(1)} · движок ${(sumGen / n).toFixed(1)}`);
