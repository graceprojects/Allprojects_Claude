// Кабины в многоместных санузлах эталонов: на чертежах houz унитазы стоят в кабинах (перегородки 0,9 м),
// а в JSON были только приборы. Добавляет «cubicle» вокруг каждого унитаза в комнате, где их ≥ 2 и кабин нет.
// Ширина 0,9 м по оси унитаза, глубина — до 1,5 м от стены, к которой он придвинут (rot 0 — стена сверху, 180 — снизу, 90/270 — сбоку).
//   node examples/add_cabins.js            — пропатчить все examples/*.json (повторный запуск ничего не меняет)
//   require("./add_cabins.js").addCabins(S) — из сборщика примера
const fs = require("fs"), path = require("path");
const r3 = v => Math.round(v * 1000) / 1000;
function addCabins(S) {
  let n = 0; const its = S.items, ab = i => { const q = (i.rot || 0) % 180; return { x: i.x, y: i.y, w: q ? i.h : i.w, h: q ? i.w : i.h }; };
  for (const r of its.filter(i => i.t === "room" && /с\/у|санузел|туалет/i.test(i.name || ""))) {
    const inR = i => i.t === "item" && (i.lv || 0) === (r.lv || 0) && (a => a.x + a.w / 2 > r.x && a.x + a.w / 2 < r.x + r.w && a.y + a.h / 2 > r.y && a.y + a.h / 2 < r.y + r.h)(ab(i));
    const wcs = its.filter(i => inR(i) && i.k === "wc"); if (wcs.length < 2 || its.some(i => inR(i) && i.k === "cubicle")) continue;
    for (const w of wcs) { const a = ab(w), rot = (w.rot || 0) % 360, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      const along = rot === 0 || rot === 180, dep = Math.min(1.5, (along ? r.h : r.w) - 1.1);
      let x, y, cw, ch;
      if (rot === 0) { x = cx - 0.45; y = r.y + 0.02; cw = 0.9; ch = dep; }
      else if (rot === 180) { x = cx - 0.45; y = r.y + r.h - 0.02 - dep; cw = 0.9; ch = dep; }
      else if (rot === 90) { x = r.x + r.w - 0.02 - dep; y = cy - 0.45; cw = dep; ch = 0.9; }
      else { x = r.x + 0.02; y = cy - 0.45; cw = dep; ch = 0.9; }
      x = Math.max(r.x + 0.02, Math.min(x, r.x + r.w - 0.02 - cw)); y = Math.max(r.y + 0.02, Math.min(y, r.y + r.h - 0.02 - ch));
      // cubicle: w — вдоль стены, h — глубина; поворот повторяет поворот унитаза (дверь кабины — к проходу)
      const q = rot % 180 !== 0;
      its.push({ id: (S.items[0] && String(S.items[0].id).replace(/\d+$/, "") || "cb") + "cab" + (++n) + "_" + Math.round(cx * 100), t: "item", lv: r.lv || 0, k: "cubicle",
        x: r3(x), y: r3(y), w: 0.9, h: r3(dep), rot, flip: false, label: "" });
      if (q) { const it = its[its.length - 1]; it.x = r3(x); it.y = r3(y); }   // при повороте 90/270 AABB = dep × 0,9 — уже учтено в x, y
    } }
  return n;
}
module.exports = { addCabins };
if (require.main === module) for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith(".json"))) {
  const p = path.join(__dirname, f), txt = fs.readFileSync(p, "utf8"), S = JSON.parse(txt), n = addCabins(S);
  if (n) { fs.writeFileSync(p, /^\{\s*\n/.test(txt) ? JSON.stringify(S, null, 1).replace(/^ +/gm, "") + (txt.endsWith("\n") ? "\n" : "") : JSON.stringify(S)); console.log(`${f}: + ${n} кабин`); } }   // формат файла — как был
