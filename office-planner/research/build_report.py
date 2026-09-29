"""Собирает страницу-отчёт из research-v2.json (результат исследования v2)."""
import json, html, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, 'research-v2.json'), encoding='utf-8'))
F = d['final']
e = lambda s: html.escape(str(s or ''))

def rich(text):
    """Абзацы и списки «- » из текста синтеза."""
    out, items = [], []
    def flush():
        if items:
            out.append('<ul>' + ''.join(f'<li>{e(i)}</li>' for i in items) + '</ul>'); items.clear()
    for line in str(text).split('\n'):
        s = line.strip()
        if not s: flush(); continue
        if s.startswith('- '): items.append(s[2:]); continue
        flush(); out.append(f'<p>{e(s)}</p>')
    flush(); return ''.join(out)

def link(s):
    s = str(s); m = re.match(r'(https?://\S+)(.*)', s)
    if m: return f'<a href="{e(m.group(1))}" target="_blank" rel="noopener">{e(m.group(1))}</a>{e(m.group(2))}'
    return e(s)

PR = {'P0': 'Обязательно для ежедневной работы', 'P1': 'Следующий шаг', 'P2': 'Позже'}
EF = {'S': 'до дня', 'M': '1–3 дня', 'L': 'больше 3 дней'}

parts = []
# 1. Главное
parts.append(f'''<section id="main"><h2>Главный вывод</h2><div class="lead">{rich(F['executive_summary'])}</div></section>''')
# конвейер
steps = ['Здание', 'Программа', 'Зоны', 'Помещения', 'ТЗ']
parts.append('<section id="flow"><h2>Как будет устроена работа</h2><p class="muted">Пять вкладок-шагов. Порядок подсказан, но не заперт: к любому шагу можно вернуться.</p><ol class="flow">' +
             ''.join(f'<li><b>{i+1}</b><span>{s}</span></li>' for i, s in enumerate(steps)) + '</ol>' +
             '<div class="rec">' + rich(F['recommended_concept']) + '</div></section>')
# 2. Методика
rows = ''.join(f'<tr><td class="nowrap"><b>{e(m["step"])}</b></td><td>{e(m["what"])}</td><td>{e(m["tool_support"])}</td></tr>' for m in F['planning_method'])
parts.append(f'<section id="method"><h2>Смысл планирования: методика по шагам</h2><p class="muted">Как архитекторы готовят задачу до проектирования (программирование по Peña/Parshall, стадии RIBA 1–2, test fit) и чем инструмент помогает на каждом шаге.</p><div class="tw"><table><thead><tr><th>Шаг</th><th>Что делаем</th><th>Чем помогает инструмент</th></tr></thead><tbody>{rows}</tbody></table></div></section>')
# 3. Принципы
parts.append('<section id="principles"><h2>Принципы продукта</h2><ol class="principles">' + ''.join(f'<li>{e(p)}</li>' for p in F['principles']) + '</ol></section>')
# 4. Конкуренты
rows = ''.join(f'<tr><td><b>{e(c["product"])}</b><div class="muted small">{e(c["type"])}</div></td><td>{e(c["strengths"])}</td><td>{e(c["weaknesses"])}</td><td class="take">{e(c["take"])}</td></tr>' for c in F['competitor_matrix'])
parts.append(f'<section id="market"><h2>Мировой опыт: что берём у каждого</h2><div class="tw"><table class="wide"><thead><tr><th>Продукт</th><th>Сильные стороны</th><th>Слабые стороны</th><th>Что берём</th></tr></thead><tbody>{rows}</tbody></table></div></section>')
# 5. Концепции
cards = ''
for s in sorted(F['concept_scores'], key=lambda x: -x['score']):
    cards += f'<div class="concept"><div class="score">{str(s["score"]).replace(".", ",")}</div><div><h3>{e(s["concept"])}</h3>{rich(s["reasoning"])}</div></div>'
parts.append(f'<section id="concepts"><h2>Три концепции и оценка</h2><p class="muted">Каждую концепцию независимо разработал отдельный агент, затем они сравнивались по четырём критериям: простота для неархитекторов, качество результата для проектировщика, привычка ежедневной работы, трудоёмкость. Оценка из 10.</p><div class="concepts">{cards}</div></section>')
# 6. Функции
feat = ''
for p in ['P0', 'P1', 'P2']:
    fs = [x for x in F['features'] if x['priority'] == p]
    if not fs: continue
    feat += f'<h3 class="prio {p}"><span class="pill {p}">{p}</span>{PR[p]} · {len(fs)}</h3>'
    for x in fs:
        feat += f'<details {"open" if p=="P0" else ""}><summary><b>{e(x["feature"])}</b><span class="eff">{EF[x["effort"]]}</span></summary><p class="why">{e(x["why"])}</p>{rich(x["spec"])}</details>'
parts.append(f'<section id="features"><h2>Что строим в версии 2</h2>{feat}</section>')
# 7. Аудит
aud = ''
for p in ['P0', 'P1', 'P2']:
    xs = [x for x in F['audit_fixes'] if x['priority'] == p]
    if not xs: continue
    rows = ''.join(f'<tr><td>{rich(x["issue"])}</td><td>{rich(x["fix"])}</td></tr>' for x in xs)
    tbl = f'<div class="tw"><table><thead><tr><th>Проблема</th><th>Исправление</th></tr></thead><tbody>{rows}</tbody></table></div>'
    aud += (f'<h3><span class="pill {p}">{p}</span>{len(xs)} шт.</h3>' + tbl) if p == 'P0' else f'<details><summary><span class="pill {p}">{p}</span><b>{len(xs)} замечаний</b></summary>{tbl}</details>'
parts.append(f'<section id="audit"><h2>Аудит текущего планировщика</h2><p class="muted">Код прочитан целиком и прогнан в браузере. P0 — блокеры, которые нужно закрыть до новых функций.</p>{aud}</section>')
# 8. Программа
rows = ''.join(f'<tr><td class="nowrap">{e(x["zone"])}</td><td><b>{e(x["room"])}</b></td><td>{e(x["area_rule"])}</td><td>{e(x["count_rule"])}</td><td>{e(x["adjacency"])}</td></tr>' for x in F['sales_office_program'])
parts.append(f'<section id="program"><h2>Шаблон программы офиса продаж</h2><p class="muted">M — менеджеров на смене, B — штат бэк-офиса. Площади в чистоте. Цифры — ориентиры для мастера, калибруются по вашим реализованным офисам.</p><div class="tw"><table class="wide"><thead><tr><th>Зона</th><th>Помещение</th><th>Площадь</th><th>Количество</th><th>Связи</th></tr></thead><tbody>{rows}</tbody></table></div></section>')
# 9. Проверки
rows = ''.join(f'<tr><td><b>{e(x["check"])}</b></td><td>{e(x["rule"])}</td><td class="src">{link(x["source"])}</td></tr>' for x in F['auto_checks'])
parts.append(f'<section id="checks"><h2>Автоматические проверки норм</h2><p class="muted">Подсказки, а не запреты. Каждое правило помечено «норма» или «ориентир»; окончательно проверяет проектировщик.</p><div class="tw"><table class="wide"><thead><tr><th>Проверка</th><th>Правило</th><th>Источник</th></tr></thead><tbody>{rows}</tbody></table></div></section>')
# 10. Дорожная карта
rm = ''.join(f'<li><div class="stage">{e(r["stage"])}</div><div class="goal">{e(r["goal"])}</div><ul>' + ''.join(f'<li>{e(i)}</li>' for i in r['items']) + '</ul></li>' for r in F['roadmap'])
parts.append(f'<section id="roadmap"><h2>Дорожная карта</h2><ol class="roadmap">{rm}</ol></section>')
# 11. Риски
parts.append('<section id="risks"><h2>Риски и ограничения исследования</h2><ul class="risks">' + ''.join(f'<li>{e(r)}</li>' for r in F['risks']) + '</ul></section>')
# 12. Исследования и источники
tracks = ''
for r in d['research']:
    tracks += f'<details><summary><b>{e(r["title"])}</b><span class="eff">{"веб: да" if r.get("web_used") else "веб: нет"}</span></summary>{rich(r["summary"])}' + \
              ('<h4>Взять</h4><ul>' + ''.join(f'<li>{e(a)}</li>' for a in r.get('adopt') or []) + '</ul>' if r.get('adopt') else '') + \
              ('<h4>Поправки фактчекера</h4><ul>' + ''.join(f'<li><b>{e(c["claim"])}</b>: {e(c["correction"])}</li>' for c in r.get('corrections') or []) + '</ul>' if r.get('corrections') else '') + '</details>'
src = ''.join(f'<li>{link(s)}</li>' for s in F['sources'] if not s.startswith('/'))
parts.append(f'<section id="sources"><h2>Исследования по направлениям</h2>{tracks}<details><summary><b>Источники</b><span class="eff">{len(F["sources"])}</span></summary><ol class="src">{src}</ol></details></section>')

nav = [('main', 'Вывод'), ('method', 'Методика'), ('market', 'Мировой опыт'), ('concepts', 'Концепции'), ('features', 'Версия 2'), ('audit', 'Аудит'), ('program', 'Программа'), ('checks', 'Нормы'), ('roadmap', 'План'), ('risks', 'Риски')]

page = f'''<title>Эскиз-ТЗ офиса продаж</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Unbounded:wght@500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: одна колонка чтения ~70ch, широкие таблицы в своих прокручиваемых контейнерах; палитра — калька и синий карандаш, как в планировщике */
:root{{
  --bg:#f2f3ef; --paper:#fbfbf8; --ink:#1d2420; --muted:#626c66; --line:#d6dad2; --accent:#1f5fa8; --accent-soft:#dde8f5;
  --p0:#b3392f; --p1:#b7791f; --p2:#5d6f66; --p0-soft:#f6dcd8; --p1-soft:#f6e8cc; --p2-soft:#e2e8e4;
  --f-display:"Unbounded","Golos Text",system-ui,sans-serif; --f-body:"Golos Text","Segoe UI",system-ui,sans-serif; --f-mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{
  --bg:#151917; --paper:#1c211e; --ink:#e6eae5; --muted:#9aa49d; --line:#323935; --accent:#72aaf0; --accent-soft:#1f3047;
  --p0:#f08a7e; --p1:#e2b25c; --p2:#9fb3a8; --p0-soft:#3c2320; --p1-soft:#3a2f1a; --p2-soft:#27302b; color-scheme:dark}}}}
:root[data-theme="dark"]{{
  --bg:#151917; --paper:#1c211e; --ink:#e6eae5; --muted:#9aa49d; --line:#323935; --accent:#72aaf0; --accent-soft:#1f3047;
  --p0:#f08a7e; --p1:#e2b25c; --p2:#9fb3a8; --p0-soft:#3c2320; --p1-soft:#3a2f1a; --p2-soft:#27302b; color-scheme:dark}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15.5px;line-height:1.6;padding-inline:16px;padding-block:0 64px}}
a{{color:var(--accent)}}
.wrap{{max-width:1080px;margin:0 auto}}
header.hero{{padding-block:44px 20px;border-bottom:1px solid var(--line)}}
.eyebrow{{font-family:var(--f-mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}}
h1{{font-family:var(--f-display);font-weight:600;font-size:clamp(28px,4.4vw,44px);line-height:1.12;margin:10px 0 12px;text-wrap:balance;letter-spacing:-.01em}}
.sub{{max-width:68ch;color:var(--muted);margin:0}}
.meta{{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}}
.meta span{{font-family:var(--f-mono);font-size:12px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;background:var(--paper);color:var(--muted);font-variant-numeric:tabular-nums}}
nav.toc{{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--line);display:flex;gap:4px;overflow-x:auto;padding-block:8px;margin-bottom:8px}}
nav.toc a{{white-space:nowrap;text-decoration:none;color:var(--muted);font-size:13px;padding:4px 10px;border-radius:6px}}
nav.toc a:hover,nav.toc a:focus-visible{{background:var(--accent-soft);color:var(--ink);outline:none}}
section{{padding-block:28px 8px;scroll-margin-top:56px}}
h2{{font-family:var(--f-display);font-weight:500;font-size:22px;margin:0 0 12px;text-wrap:balance}}
h3{{font-size:16px;margin:22px 0 10px;display:flex;align-items:center;gap:10px}}
h4{{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:14px 0 4px}}
p{{margin:0 0 10px;max-width:72ch}}
ul,ol{{margin:0 0 12px;padding-left:22px}} li{{margin:3px 0}}
.muted{{color:var(--muted)}} .small{{font-size:12.5px}}
.lead{{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:18px 22px}}
.lead p{{max-width:78ch}}
.flow{{list-style:none;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;margin:14px 0 18px;counter-reset:none}}
.flow li{{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid var(--line);background:var(--paper);margin:0}}
.flow li+li{{border-left:0}} .flow li:first-child{{border-radius:10px 0 0 10px}} .flow li:last-child{{border-radius:0 10px 10px 0;background:var(--accent-soft)}}
.flow b{{font-family:var(--f-mono);color:var(--accent);font-size:13px}} .flow span{{font-weight:600}}
.rec{{border-left:3px solid var(--accent);padding:4px 0 4px 16px}}
.tw{{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--paper);margin:8px 0 14px}}
table{{border-collapse:collapse;width:100%;font-size:13.5px;line-height:1.45}}
table.wide{{min-width:860px}}
th{{text-align:left;font-weight:600;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0}}
td{{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}}
tr:last-child td{{border-bottom:0}}
td p{{margin:0 0 6px}} td ul{{margin:4px 0 0}}
td.take{{background:var(--accent-soft)}} td.src{{font-size:12px;word-break:break-word;color:var(--muted)}}
.nowrap{{white-space:nowrap}}
.principles li{{margin:6px 0;max-width:78ch}}
.concepts{{display:grid;gap:12px}}
.concept{{display:grid;grid-template-columns:72px 1fr;gap:16px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:16px}}
.concept:first-child{{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}}
.concept h3{{margin:0 0 6px}} .concept>div{{min-width:0}}
.score{{font-family:var(--f-display);font-size:30px;font-weight:600;color:var(--accent);font-variant-numeric:tabular-nums}}
.pill{{font-family:var(--f-mono);font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:5px}}
.pill.P0{{background:var(--p0-soft);color:var(--p0)}} .pill.P1{{background:var(--p1-soft);color:var(--p1)}} .pill.P2{{background:var(--p2-soft);color:var(--p2)}}
details{{background:var(--paper);border:1px solid var(--line);border-radius:10px;margin:8px 0;padding:0 16px}}
details[open]{{padding-bottom:10px}}
summary{{cursor:pointer;padding:12px 0;display:flex;gap:10px;align-items:baseline;list-style:none}}
summary::-webkit-details-marker{{display:none}}
summary::before{{content:"+";font-family:var(--f-mono);color:var(--accent);width:12px;flex:none}}
details[open]>summary::before{{content:"−"}}
summary:focus-visible{{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}}
.eff{{margin-left:auto;font-family:var(--f-mono);font-size:11.5px;color:var(--muted);white-space:nowrap}}
.why{{color:var(--muted);font-style:italic}}
.roadmap{{list-style:none;padding:0;position:relative}}
.roadmap>li{{position:relative;padding:0 0 18px 26px;border-left:2px solid var(--line);margin:0 0 0 6px}}
.roadmap>li::before{{content:"";position:absolute;left:-7px;top:6px;width:12px;height:12px;border-radius:50%;background:var(--paper);border:2px solid var(--accent)}}
.stage{{font-weight:700}} .goal{{color:var(--muted);margin-bottom:4px}}
.risks li{{margin:8px 0;max-width:80ch}}
ol.src{{font-size:12.5px;word-break:break-word}}
footer{{margin-top:36px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}}
@media (max-width:640px){{.flow{{grid-template-columns:1fr}} .flow li+li{{border-left:1px solid var(--line);border-top:0}} .flow li:first-child{{border-radius:10px 10px 0 0}} .flow li:last-child{{border-radius:0 0 10px 10px}} .concept{{grid-template-columns:1fr}} body{{font-size:15px}}}}
@media (prefers-reduced-motion: reduce){{*{{scroll-behavior:auto!important}}}}
html{{scroll-behavior:smooth}}
</style>
<div class="wrap">
<header class="hero">
  <div class="eyebrow">Исследование и концепция · планировщик офиса продаж</div>
  <h1>Эскиз-ТЗ офиса продаж: как сделать простой инструмент, которым пользуются каждый день</h1>
  <p class="sub">Разбор Homestyler и 15 аналогов, методика раннего планирования, программа помещений и нормы для офиса продаж девелопера, аудит нашего планировщика v1 и план версии 2.</p>
  <div class="meta"><span>22 агента-исследователя</span><span>7 направлений + 3 дополнительных</span><span>фактчек каждого направления</span><span>{len(F['features'])} функций v2</span><span>{len(F['auto_checks'])} проверок норм</span><span>{len(F['sources'])} источников</span></div>
</header>
<nav class="toc" aria-label="Разделы">{''.join(f'<a href="#{a}">{t}</a>' for a, t in nav)}</nav>
{''.join(parts)}
<footer>Результат — «Техническое задание на планировку (эскиз заказчика)», не проектная документация. Нормы даны со ссылками на пункты СП и требуют сверки с проектировщиком. Часть сайтов (Homestyler, cntd, сайты девелоперов) во время исследования была недоступна; такие данные помечены в разделе «Риски».</footer>
</div>
'''
open(os.path.join(HERE, 'report.html'), 'w', encoding='utf-8').write(page)
print('ok', len(page))
