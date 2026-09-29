#!/usr/bin/env python3
"""Читает опросник/ТЗ заказчика и печатает текст, где ОТМЕЧЕННЫЕ варианты видны явно.

    python3 read_brief.py Опросник.docx        # .docx .pdf .txt .md .html
Отметки в Word бывают разные: выделение цветом, заливка, жирный на варианте, ☒/☑/✓/X вместо ☐,
галочки-элементы управления. Всё это превращается в «[✔ …]», а пустые варианты остаются «☐ …».
Строки таблиц печатаются через « | », чтобы было видно: помещение | нужно? | вариант | комментарий.
Без внешних зависимостей (для PDF нужен pdftotext, если он есть).
"""
import sys, re, zipfile, subprocess, html

CHECKED = "☒☑✓✔✅⊠■"

def docx_text(path):
    x = zipfile.ZipFile(path).read("word/document.xml").decode("utf8")
    out = []
    for tr in re.split(r"(?=<w:tr[ >])", x):
        cells = re.findall(r"<w:tc>.*?</w:tc>", tr, flags=re.S) or [tr]
        row = []
        for tc in cells:
            paras = []
            for p in re.findall(r"<w:p[ >].*?</w:p>", tc, flags=re.S):
                buf = []
                for r in re.findall(r"<w:r[ >].*?</w:r>|<w14:checkbox>.*?</w14:checkbox>", p, flags=re.S):
                    rpr = (re.search(r"<w:rPr>.*?</w:rPr>", r, flags=re.S) or [""])
                    rpr = rpr.group(0) if hasattr(rpr, "group") else ""
                    t = "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", r)) + ("\n" if "<w:br/>" in r else "")
                    marked = bool(re.search(r'<w:highlight w:val="(?!none)|<w:shd [^>]*w:fill="(?!auto|FFFFFF)[0-9A-Fa-f]{6}"', rpr)) \
                        or 'w14:checked w14:val="1"' in r or any(c in t for c in CHECKED)
                    if marked and t.strip():
                        t = "[✔" + re.sub("[☐" + CHECKED + "]", "", t).rstrip() + "]"
                    buf.append(t)
                s = html.unescape("".join(buf))
                s = re.sub(r"\]\s*\[✔", " ", s)          # склеиваем соседние отмеченные куски
                if s.strip(): paras.append(s.strip())
            row.append(" / ".join(paras))
        line = " | ".join(c for c in row if c)
        if line.strip(): out.append(line)
    return "\n".join(out)

def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    f = sys.argv[1]; low = f.lower()
    if low.endswith(".docx"): print(docx_text(f))
    elif low.endswith(".pdf"):
        try: print(subprocess.run(["pdftotext", "-layout", f, "-"], capture_output=True, text=True, check=True).stdout)
        except Exception: print("pdftotext нет — прочитайте PDF инструментом Read (отметки в PDF смотрите глазами на странице).")
    elif low.endswith((".html", ".htm")):
        print(html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style).*?</\1>", "", open(f, encoding="utf8").read(), flags=re.S))))
    else: print(open(f, encoding="utf8", errors="replace").read())

if __name__ == "__main__": main()
