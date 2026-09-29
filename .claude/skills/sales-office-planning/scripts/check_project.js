#!/usr/bin/env node
/* Проверка готового файла проекта планировщика: программа цель/факт и мягкие проверки норм.
 *   node check_project.js project.json
 */
const fs = require("fs"), path = require("path");
const KB = require(path.join(__dirname, "office-kb.js"));
const f = process.argv[2];
if (!f) { console.error("Укажите файл проекта: node check_project.js project.json"); process.exit(1); }
const S = JSON.parse(fs.readFileSync(f, "utf8"));
if (!S.b || !Array.isArray(S.items)) { console.error("Это не файл проекта планировщика (нет b / items)."); process.exit(1); }
console.log(KB.summary(S));
