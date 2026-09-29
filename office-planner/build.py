"""Сборка: встраивает src/office-kb.js в планировщик и раскладывает копии.

  index.html                 — версия для claude.ai (артефакт), KB между маркерами KB:BEGIN/KB:END
  local/index.html           — локальная версия (three.js рядом)
  Планировщик-офиса.html      — один файл, всё внутри
  ../.claude/skills/sales-office-planning/scripts/office-kb.js — ядро для скилла Claude
"""
import os, re, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
kb = open(os.path.join(HERE, 'src', 'office-kb.js'), encoding='utf-8').read()
p = os.path.join(HERE, 'index.html')
s = open(p, encoding='utf-8').read()
s = re.sub(r'/\* KB:BEGIN \*/\n.*?\n/\* KB:END \*/', lambda m: '/* KB:BEGIN */\n' + kb + '\n/* KB:END */', s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s)
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
head = ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
        '<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style></head><body>\n')
local = head + s.replace(CDN, '<script src="three.min.js"></script>') + '\n</body></html>\n'
open(os.path.join(HERE, 'local', 'index.html'), 'w', encoding='utf-8').write(local)
three = open(os.path.join(HERE, 'local', 'three.min.js'), encoding='utf-8').read()
single = head + s.replace(CDN, '<script>' + three.replace('</script', '<\\/script') + '</script>') + '\n</body></html>\n'
open(os.path.join(HERE, 'Планировщик-офиса.html'), 'w', encoding='utf-8').write(single)
skill = os.path.join(ROOT, '.claude', 'skills', 'sales-office-planning', 'scripts')
if os.path.isdir(skill):
    shutil.copy(os.path.join(HERE, 'src', 'office-kb.js'), os.path.join(skill, 'office-kb.js'))
print('built')
