"""Сборка: встраивает src/office-kb.js в планировщик и раскладывает копии.

  index.html                 — версия для claude.ai (артефакт), KB между маркерами KB:BEGIN/KB:END
  local/index.html           — локальная версия (three.js рядом)
  Планировщик-офиса.html      — один файл, всё внутри
  ../.claude/skills/sales-office-planning/scripts/office-kb.js — ядро для скилла Claude
"""
import os, re, shutil, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
kb = open(os.path.join(HERE, 'src', 'office-kb.js'), encoding='utf-8').read()
p = os.path.join(HERE, 'index.html')
s = open(p, encoding='utf-8').read()
s = re.sub(r'/\* KB:BEGIN \*/\n.*?\n/\* KB:END \*/', lambda m: '/* KB:BEGIN */\n' + kb + '\n/* KB:END */', s, flags=re.S)
for key, fn in (('chine', 'chine-house.json'), ('olam', 'olam-nazarbek.json'), ('olam2', 'olam-nazarbek-v2.json')):
    ex = os.path.join(HERE, 'examples', fn)
    if os.path.exists(ex):
        js = json.dumps(json.load(open(ex, encoding='utf-8')), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        s = re.sub(r'/\* EX:' + key + r' \*/.*?/\* /EX \*/', lambda m: '/* EX:' + key + ' */' + js + '/* /EX */', s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s)
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
head = ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
        '<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style></head><body>\n')
local = head + s.replace(CDN, '<script src="three.min.js"></script>') + '\n</body></html>\n'
open(os.path.join(HERE, 'local', 'index.html'), 'w', encoding='utf-8').write(local)
three = open(os.path.join(HERE, 'local', 'three.min.js'), encoding='utf-8').read()
single = head + s.replace(CDN, '<script>' + three.replace('</script', '<\\/script') + '</script>') + '\n</body></html>\n'
open(os.path.join(HERE, 'Планировщик-офиса.html'), 'w', encoding='utf-8').write(single)
# сайт: статическая папка для любого хостинга (GitHub Pages, Netlify, свой сервер)
site = os.path.join(HERE, 'site'); os.makedirs(site, exist_ok=True)
open(os.path.join(site, 'index.html'), 'w', encoding='utf-8').write(single)
rep = os.path.join(HERE, 'research', 'report.html')
if os.path.exists(rep):
    open(os.path.join(site, 'report.html'), 'w', encoding='utf-8').write(head + open(rep, encoding='utf-8').read() + '\n</body></html>\n')
open(os.path.join(site, '.nojekyll'), 'w').write('')
skill = os.path.join(ROOT, '.claude', 'skills', 'sales-office-planning', 'scripts')
if os.path.isdir(skill):
    shutil.copy(os.path.join(HERE, 'src', 'office-kb.js'), os.path.join(skill, 'office-kb.js'))
skill2 = os.path.join(ROOT, '.claude', 'skills', 'office-brief-to-plan', 'scripts')
if os.path.isdir(skill2):
    shutil.copy(os.path.join(HERE, 'src', 'office-kb.js'), os.path.join(skill2, 'office-kb.js'))
# MCP-сервер: Claude Desktop / Code управляет планировщиком (zip и .mcpb для установки)
import zipfile
mcp = os.path.join(HERE, 'mcp')
refs = os.path.join(ROOT, '.claude', 'skills', 'sales-office-planning', 'references')
def mcp_bundle(path):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in ['server.js', 'manifest.json', 'package.json', 'README.md']:
            z.write(os.path.join(mcp, f), f)
        z.write(os.path.join(HERE, 'src', 'office-kb.js'), 'office-kb.js')
        z.write(os.path.join(HERE, 'local', 'index.html'), 'app/index.html')
        z.write(os.path.join(HERE, 'local', 'three.min.js'), 'app/three.min.js')
        if os.path.isdir(refs):
            for f in sorted(os.listdir(refs)):
                if f.endswith('.md'): z.write(os.path.join(refs, f), 'guide/' + f)
if os.path.isdir(mcp):
    mcp_bundle(os.path.join(site, 'office-planner-mcp.zip'))
    mcp_bundle(os.path.join(site, 'office-planner.mcpb'))
print('built')
