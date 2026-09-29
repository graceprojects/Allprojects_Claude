"""Эскизный 2D-план офиса продаж 40 x 12 м с антресолью (бэк-офис).

Строит два листа A2 в масштабе 1:100:
  Лист 1 — план 1-го этажа (отм. 0.000);
  Лист 2 — план антресоли (отм. +3.300) и разрез 1-1.

Все координаты — в метрах: X вдоль дороги (0..40), Y в глубину участка (0..12),
Y = 0 — витринный фасад со стороны дороги.

Запуск: python3 draw_plan.py  -> office_plan.pdf, sheet1_floor1.png, sheet2_mezzanine.png
"""
import math
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import Arc, Circle, Polygon, Rectangle, Wedge

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- sheet setup
PAGE_W, PAGE_H = 594, 420          # A2 landscape, мм
S = 10                              # 1:100 -> 1 м = 10 мм
OX, OY = 75, 240                    # положение точки (0,0) плана на листе, мм

C_WALL = "#3d3d3d"
C_GLASS = "#9fd3f0"
C_GLASS_EDGE = "#2b7bb9"
C_HALL = "#f7f2e8"
C_CAB = "#e2eef9"
C_CLIENT = "#fbe7d3"
C_SERV = "#ececec"
C_WC = "#dcf1ee"
C_BACK = "#ece3f5"
C_KIDS = "#fff6c7"
C_FURN = "#ffffff"
C_FURN_EDGE = "#6b6b6b"
C_DIM = "#b03a2e"
C_GHOST = "#b5b5b5"

ROOM_FS = 5.6
SMALL_FS = 4.6


class Sheet:
    def __init__(self, ox=OX, oy=OY):
        self.fig = plt.figure(figsize=(PAGE_W / 25.4, PAGE_H / 25.4))
        self.ax = self.fig.add_axes([0, 0, 1, 1])
        self.ax.set_xlim(0, PAGE_W)
        self.ax.set_ylim(0, PAGE_H)
        self.ax.set_aspect("equal")
        self.ax.axis("off")
        self.ox, self.oy = ox, oy

    # coordinate transform: метры плана -> мм листа
    def T(self, x, y):
        return (self.ox + x * S, self.oy + y * S)

    def rect(self, x0, y0, x1, y1, fc="none", ec="none", lw=0.4, z=1, **kw):
        (px, py) = self.T(min(x0, x1), min(y0, y1))
        self.ax.add_patch(Rectangle((px, py), abs(x1 - x0) * S, abs(y1 - y0) * S,
                                    facecolor=fc, edgecolor=ec, linewidth=lw, zorder=z, **kw))

    def poly(self, pts, fc="none", ec="none", lw=0.4, z=1, **kw):
        self.ax.add_patch(Polygon([self.T(*p) for p in pts], closed=True, facecolor=fc,
                                  edgecolor=ec, linewidth=lw, zorder=z, **kw))

    def line(self, pts, color="k", lw=0.4, z=4, ls="-", **kw):
        xs, ys = zip(*[self.T(*p) for p in pts])
        self.ax.plot(xs, ys, color=color, lw=lw, zorder=z, ls=ls, solid_capstyle="butt", **kw)

    def text(self, x, y, s, fs=ROOM_FS, z=9, ha="center", va="center", **kw):
        self.ax.text(*self.T(x, y), s, fontsize=fs, ha=ha, va=va, zorder=z,
                     linespacing=1.15, **kw)

    def ptext(self, px, py, s, fs=7, ha="left", va="center", **kw):
        """Текст в координатах листа (мм)."""
        self.ax.text(px, py, s, fontsize=fs, ha=ha, va=va, zorder=11, **kw)

    # ------------------------------------------------------------ building parts
    def wall(self, x0, y0, x1, y1, t=0.15, z=5, fc=C_WALL):
        if y0 == y1:
            self.rect(x0, y0 - t / 2, x1, y0 + t / 2, fc=fc, z=z)
        else:
            self.rect(x0 - t / 2, y0, x0 + t / 2, y1, fc=fc, z=z)

    def glass(self, x0, y0, x1, y1, t=0.1, z=5):
        if y0 == y1:
            self.rect(x0, y0 - t / 2, x1, y0 + t / 2, fc=C_GLASS, ec=C_GLASS_EDGE, lw=0.3, z=z)
            self.line([(x0, y0), (x1, y1)], color=C_GLASS_EDGE, lw=0.25, z=z + 0.1)
        else:
            self.rect(x0 - t / 2, y0, x0 + t / 2, y1, fc=C_GLASS, ec=C_GLASS_EDGE, lw=0.3, z=z)
            self.line([(x0, y0), (x1, y1)], color=C_GLASS_EDGE, lw=0.25, z=z + 0.1)

    def clear(self, x0, y0, x1, y1):
        """Проём в стене."""
        self.rect(x0, y0, x1, y1, fc="white", z=5.5)

    def door(self, hx, hy, d, n, w=0.9, z=6):
        """Распашная дверь: петля (hx,hy), d — вдоль стены к притвору, n — направление открывания."""
        ex, ey = hx + n[0] * w, hy + n[1] * w
        self.line([(hx, hy), (ex, ey)], color="k", lw=0.7, z=z)
        a1 = math.degrees(math.atan2(d[1], d[0]))
        a2 = math.degrees(math.atan2(n[1], n[0]))
        if (a2 - a1) % 360 == 90:
            t1, t2 = a1, a2
        else:
            t1, t2 = a2, a1
        self.ax.add_patch(Arc(self.T(hx, hy), 2 * w * S, 2 * w * S, theta1=t1, theta2=t2,
                              color="k", lw=0.3, zorder=z))

    def door_in_wall(self, hx, hy, d, n, w=0.9, t=0.15):
        """Проём + дверь."""
        x1, y1 = hx + d[0] * w, hy + d[1] * w
        if d[1] == 0:
            self.clear(min(hx, x1), hy - t / 2 - 0.01, max(hx, x1), hy + t / 2 + 0.01)
        else:
            self.clear(hx - t / 2 - 0.01, min(hy, y1), hx + t / 2 + 0.01, max(hy, y1))
        self.door(hx, hy, d, n, w)

    def sliding_door(self, x0, y, w=0.9, side=-1):
        """Раздвижная дверь в стеклянной перегородке (горизонтальной)."""
        self.clear(x0, y - 0.06, x0 + w, y + 0.06)
        off = side * 0.1
        self.rect(x0 - 0.05, y + off - 0.03, x0 + w * 0.55, y + off + 0.03,
                  fc="white", ec="k", lw=0.5, z=6)
        self.line([(x0 + w * 0.15, y + off * 1.8), (x0 + w * 0.75, y + off * 1.8)],
                  color="k", lw=0.25, z=6)

    def column(self, cx, cy, a=0.4, z=7):
        self.rect(cx - a / 2, cy - a / 2, cx + a / 2, cy + a / 2, fc="#1f1f1f", z=z)

    # ------------------------------------------------------------ furniture
    def chair(self, cx, cy, back="s", a=0.45):
        self.rect(cx - a / 2, cy - a / 2, cx + a / 2, cy + a / 2, fc=C_FURN, ec=C_FURN_EDGE, lw=0.3, z=3)
        b = 0.08
        if back == "s":
            self.rect(cx - a / 2, cy - a / 2, cx + a / 2, cy - a / 2 + b, fc=C_FURN_EDGE, z=3.1)
        elif back == "n":
            self.rect(cx - a / 2, cy + a / 2 - b, cx + a / 2, cy + a / 2, fc=C_FURN_EDGE, z=3.1)
        elif back == "w":
            self.rect(cx - a / 2, cy - a / 2, cx - a / 2 + b, cy + a / 2, fc=C_FURN_EDGE, z=3.1)
        elif back == "e":
            self.rect(cx + a / 2 - b, cy - a / 2, cx + a / 2, cy + a / 2, fc=C_FURN_EDGE, z=3.1)

    def table(self, x0, y0, x1, y1):
        self.rect(x0, y0, x1, y1, fc=C_FURN, ec=C_FURN_EDGE, lw=0.4, z=3)

    def sofa(self, x0, y0, x1, y1, back="s", seats=3):
        self.rect(x0, y0, x1, y1, fc=C_FURN, ec=C_FURN_EDGE, lw=0.4, z=3)
        b = 0.2
        if back in "sn":
            yb = (y0, y0 + b) if back == "s" else (y1 - b, y1)
            self.rect(x0, yb[0], x1, yb[1], fc="#d9d9d9", ec=C_FURN_EDGE, lw=0.3, z=3.1)
            for i in range(1, seats):
                xx = x0 + (x1 - x0) * i / seats
                self.line([(xx, y0), (xx, y1)], color=C_FURN_EDGE, lw=0.25, z=3.2)
        else:
            xb = (x0, x0 + b) if back == "w" else (x1 - b, x1)
            self.rect(xb[0], y0, xb[1], y1, fc="#d9d9d9", ec=C_FURN_EDGE, lw=0.3, z=3.1)
            for i in range(1, seats):
                yy = y0 + (y1 - y0) * i / seats
                self.line([(x0, yy), (x1, yy)], color=C_FURN_EDGE, lw=0.25, z=3.2)

    def lounge_group(self, cx, y0=0.75):
        """Мягкая зона у витража: диван спиной к стеклу, столик, два кресла."""
        self.sofa(cx - 1.1, y0, cx + 1.1, y0 + 0.9, back="s")
        self.table(cx - 0.6, y0 + 1.2, cx + 0.6, y0 + 1.8)
        for dx in (-0.6, 0.6):
            self.rect(cx + dx - 0.4, y0 + 2.1, cx + dx + 0.4, y0 + 2.9, fc=C_FURN, ec=C_FURN_EDGE, lw=0.4, z=3)
            self.rect(cx + dx - 0.4, y0 + 2.7, cx + dx + 0.4, y0 + 2.9, fc="#d9d9d9", ec=C_FURN_EDGE, lw=0.3, z=3.1)

    def cafe_table(self, cx, cy):
        self.table(cx - 0.425, cy - 0.425, cx + 0.425, cy + 0.425)
        self.chair(cx, cy + 0.7, "n")
        self.chair(cx, cy - 0.7, "s")
        self.chair(cx - 0.7, cy, "w")
        self.chair(cx + 0.7, cy, "e")

    def wc(self, cx, cy, facing="s"):
        """Унитаз (овал), facing — куда обращена чаша."""
        from matplotlib.patches import Ellipse
        if facing in "sn":
            tank_y = cy + 0.25 if facing == "s" else cy - 0.25
            self.rect(cx - 0.22, tank_y - 0.1, cx + 0.22, tank_y + 0.1, fc=C_FURN, ec=C_FURN_EDGE, lw=0.3, z=3)
            self.ax.add_patch(Ellipse(self.T(cx, cy - (0.05 if facing == "s" else -0.05)), 3.6, 5.0,
                                      facecolor=C_FURN, edgecolor=C_FURN_EDGE, lw=0.3, zorder=3))
        else:
            tank_x = cx + 0.25 if facing == "w" else cx - 0.25
            self.rect(tank_x - 0.1, cy - 0.22, tank_x + 0.1, cy + 0.22, fc=C_FURN, ec=C_FURN_EDGE, lw=0.3, z=3)
            self.ax.add_patch(Ellipse(self.T(cx - (0.05 if facing == "w" else -0.05), cy), 5.0, 3.6,
                                      facecolor=C_FURN, edgecolor=C_FURN_EDGE, lw=0.3, zorder=3))

    def sink(self, cx, cy):
        from matplotlib.patches import Ellipse
        self.ax.add_patch(Ellipse(self.T(cx, cy), 4.0, 3.0, facecolor=C_FURN, edgecolor=C_FURN_EDGE,
                                  lw=0.3, zorder=3.2))

    # ------------------------------------------------------------ annotation
    def dim_h(self, xs, y, y_from=None, fs=5.2, labels=None):
        self.line([(xs[0] - 0.3, y), (xs[-1] + 0.3, y)], color=C_DIM, lw=0.3, z=7)
        for x in xs:
            if y_from is not None:
                self.line([(x, y_from), (x, y + (0.25 if y > y_from else -0.25))], color=C_DIM, lw=0.2, z=7)
            self.line([(x - 0.15, y - 0.15), (x + 0.15, y + 0.15)], color=C_DIM, lw=0.7, z=7)
        for i in range(len(xs) - 1):
            lab = labels[i] if labels else f"{round((xs[i + 1] - xs[i]) * 1000)}"
            self.text((xs[i] + xs[i + 1]) / 2, y + 0.28, lab, fs=fs, color=C_DIM, va="bottom")

    def dim_v(self, ys, x, x_from=None, fs=5.2, labels=None):
        self.line([(x, ys[0] - 0.3), (x, ys[-1] + 0.3)], color=C_DIM, lw=0.3, z=7)
        for y in ys:
            if x_from is not None:
                self.line([(x_from, y), (x + (0.25 if x > x_from else -0.25), y)], color=C_DIM, lw=0.2, z=7)
            self.line([(x - 0.15, y - 0.15), (x + 0.15, y + 0.15)], color=C_DIM, lw=0.7, z=7)
        for i in range(len(ys) - 1):
            lab = labels[i] if labels else f"{round((ys[i + 1] - ys[i]) * 1000)}"
            self.text(x - 0.28, (ys[i] + ys[i + 1]) / 2, lab, fs=fs, color=C_DIM, rotation=90, ha="right")

    def bubble(self, x, y, label):
        self.ax.add_patch(Circle(self.T(x, y), 3.6, facecolor="white", edgecolor="k", lw=0.5, zorder=8))
        self.text(x, y, label, fs=6.5, z=9)

    def room_label(self, x, y, num, name, area, fs=ROOM_FS, **kw):
        s = f"{num}. {name}" if num else name
        if area is not None:
            s += f"\n{area:.1f} м²"
        self.text(x, y, s, fs=fs, **kw)

    def frame(self, title, sheet_no, sheet_name):
        ax = self.ax
        ax.add_patch(Rectangle((20, 5), PAGE_W - 25, PAGE_H - 10, fill=False, lw=1.0, zorder=10))
        self.ptext(OX, 405, title, fs=13, weight="bold")
        # штамп
        x0, y0, w, h = PAGE_W - 5 - 185, 5, 185, 40
        ax.add_patch(Rectangle((x0, y0), w, h, facecolor="white", edgecolor="k", lw=0.8, zorder=10))
        for yy in (y0 + 10, y0 + 20, y0 + 30):
            ax.plot([x0, x0 + w], [yy, yy], color="k", lw=0.4, zorder=10)
        ax.plot([x0 + 130, x0 + 130], [y0, y0 + 20], color="k", lw=0.4, zorder=10)
        ax.plot([x0 + 155, x0 + 155], [y0, y0 + 20], color="k", lw=0.4, zorder=10)
        self.ptext(x0 + 3, y0 + 35, "Офис продаж 40 × 12 м с антресолью (бэк-офис)", fs=8, weight="bold")
        self.ptext(x0 + 3, y0 + 25, "Эскизная планировка. Функциональное наполнение — по ТЗ заказчика", fs=6)
        self.ptext(x0 + 3, y0 + 15, sheet_name, fs=7.5)
        self.ptext(x0 + 3, y0 + 5, "Масштаб 1:100 (формат А2)", fs=6.5)
        self.ptext(x0 + 132, y0 + 15, "Стадия", fs=6)
        self.ptext(x0 + 142, y0 + 5, "ЭП", fs=7.5, ha="center")
        self.ptext(x0 + 157, y0 + 15, "Лист", fs=6)
        self.ptext(x0 + 170, y0 + 5, str(sheet_no), fs=7.5, ha="center")

    def table_block(self, x0, ytop, title, rows, widths=(10, 118, 22)):
        """Экспликация помещений."""
        ax = self.ax
        W = sum(widths)
        rh = 4.6
        ax.add_patch(Rectangle((x0, ytop - 8), W, 8, facecolor="#f0f0f0", edgecolor="k", lw=0.5, zorder=10))
        self.ptext(x0 + W / 2, ytop - 4, title, fs=7.5, ha="center", weight="bold")
        y = ytop - 8
        hdr = ("№", "Наименование", "Площадь, м²")
        cx = x0
        ax.add_patch(Rectangle((x0, y - rh), W, rh, facecolor="#f7f7f7", edgecolor="k", lw=0.4, zorder=10))
        for wdt, h in zip(widths, hdr):
            self.ptext(cx + wdt / 2, y - rh / 2, h, fs=6, ha="center")
            cx += wdt
        y -= rh
        for r in rows:
            bold = r[0] == "" and r[1].startswith("ИТОГО")
            ax.add_patch(Rectangle((x0, y - rh), W, rh, facecolor="white", edgecolor="k", lw=0.3, zorder=10))
            cx = x0
            for i, (wdt, val) in enumerate(zip(widths, r)):
                ha = "left" if i == 1 else "center"
                px = cx + 2 if i == 1 else cx + wdt / 2
                self.ptext(px, y - rh / 2, val, fs=5.8, ha=ha, weight="bold" if bold else "normal")
                cx += wdt
            y -= rh
        cx = x0
        for wdt in widths[:-1]:
            cx += wdt
            ax.plot([cx, cx], [ytop - 8, y], color="k", lw=0.3, zorder=10.5)
        return y

    def save(self, pdf, png):
        pdf.savefig(self.fig)
        self.fig.savefig(png, dpi=130)
        plt.close(self.fig)


# ============================================================ общая оболочка
COL_X = [0, 5, 10, 15, 20, 25, 30, 35, 40]
AXIS_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]


def shell(sh, level):
    """Наружные стены, витраж, колонны, оси, размеры."""
    sh.rect(0, 11.7, 40, 12, fc=C_WALL, z=5)                  # задняя стена
    sh.rect(0, 0, 0.3, 12, fc=C_WALL, z=5)                     # торец слева
    sh.rect(39.7, 0, 40, 12, fc=C_WALL, z=5)                   # торец справа
    # витражный фасад вдоль дороги
    sh.rect(0.3, 0, 39.7, 0.3, fc=C_GLASS, ec=C_GLASS_EDGE, lw=0.3, z=5)
    sh.line([(0.3, 0.1), (39.7, 0.1)], color=C_GLASS_EDGE, lw=0.25, z=5.1)
    sh.line([(0.3, 0.2), (39.7, 0.2)], color=C_GLASS_EDGE, lw=0.25, z=5.1)
    for x in COL_X[1:-1]:
        for y in (0, 12):
            yy = 0.2 if y == 0 else 11.8
            sh.column(x, yy)
    for y in (0.2, 11.8):
        sh.column(0.2, y)
        sh.column(39.8, y)
    # колонны антресоли
    sh.column(30, 5.0, a=0.3)
    sh.column(35, 5.0, a=0.3)

    # оси и размеры
    for x, n in zip(COL_X, AXIS_NAMES):
        sh.line([(x, 12.0), (x, 14.6)], color="k", lw=0.2, z=2, ls=(0, (6, 2, 1, 2)))
        sh.bubble(x, 15.0, n)
    for y, n in ((0, "А"), (12, "Б")):
        sh.line([(-3.4, y), (-0.1, y)], color="k", lw=0.2, z=2, ls=(0, (6, 2, 1, 2)))
        sh.bubble(-3.8, y, n)
    sh.dim_h(COL_X, 12.9, y_from=12.05)
    sh.dim_h([0, 40], 13.8, labels=["40000"])
    sh.dim_v([0, 12], -2.4, labels=["12000"])
    sh.dim_v([0, 0.3, 5.0, 6.6, 11.7, 12.0], -1.3, x_from=-0.05,
             labels=["", "4700", "1600", "5100", ""])
    sh.dim_v([0, 0.3, 5.0, 6.6, 11.7, 12.0], 41.2, x_from=40.05,
             labels=["", "4700", "1600", "5100", ""])
    # линия разреза 1-1
    for x in (-1.9, 41.9):
        sh.line([(x - 0.6, 6.0), (x + 0.6, 6.0)], color="k", lw=1.4, z=8)
        sh.ax.annotate("", xy=sh.T(x, 7.1), xytext=sh.T(x, 6.0),
                       arrowprops=dict(arrowstyle="-|>", lw=0.8, color="k"), zorder=8)
        sh.text(x + (-0.7 if x < 0 else 0.7), 6.7, "1", fs=8, weight="bold")


# ============================================================ ЛИСТ 1
def sheet1(pdf):
    sh = Sheet()
    sh.frame("ОФИС ПРОДАЖ 40 × 12 м — ПЛАН 1-ГО ЭТАЖА (отм. 0.000)", 1,
             "План 1-го этажа")

    # ---- заливки помещений
    sh.rect(0.3, 0.3, 30, 8.5, fc=C_HALL)                       # зал
    sh.rect(25.3, 8.5, 30, 11.7, fc=C_HALL)                     # проход к сервисному блоку
    sh.rect(0.3, 8.5, 4.3, 11.7, fc="#f3e6cf")                  # бар
    sh.rect(4.3, 8.5, 22.3, 11.7, fc=C_CAB)                     # кабинеты
    sh.rect(22.3, 8.5, 25.3, 11.7, fc=C_SERV)                   # касса
    sh.rect(30, 0.3, 35, 5.0, fc=C_CLIENT)                      # VIP
    sh.rect(35, 0.3, 39.7, 5.0, fc=C_SERV)                      # кухня
    sh.rect(30, 5.0, 39.7, 6.6, fc="#f4f4f4")                   # коридор
    sh.rect(30, 6.6, 32.8, 11.7, fc="#f4f4f4")                  # лестница
    sh.rect(32.8, 6.6, 37.8, 11.7, fc=C_WC)                     # санузлы
    sh.rect(37.8, 6.6, 39.7, 11.7, fc=C_SERV)                   # КУИ, щитовая
    sh.ax.add_patch(Wedge(sh.T(0.3, 0.3), 35, 0, 90, facecolor=C_KIDS, edgecolor="#d4a017",
                          lw=0.6, zorder=1.5))                   # детская зона R=3.5

    shell(sh, 0)

    # ---- тамбур и входные двери
    sh.glass(21.2, 0.3, 21.2, 2.5)
    sh.glass(23.8, 0.3, 23.8, 2.5)
    sh.glass(21.2, 2.5, 23.8, 2.5)
    sh.rect(21.25, 0.3, 23.75, 2.45, fc="#eef7fc", z=1.2)
    sh.clear(21.6, -0.01, 23.4, 0.31)
    sh.door(21.6, 0.0, (1, 0), (0, -1), 0.9)
    sh.door(23.4, 0.0, (-1, 0), (0, -1), 0.9)
    sh.clear(21.6, 2.44, 23.4, 2.56)
    sh.door(21.6, 2.5, (1, 0), (0, 1), 0.9)
    sh.door(23.4, 2.5, (-1, 0), (0, 1), 0.9)
    sh.room_label(22.5, 1.45, "1", "Тамбур", 5.4, fs=SMALL_FS)
    sh.ax.annotate("ГЛАВНЫЙ ВХОД", xy=sh.T(22.5, -0.95), xytext=sh.T(22.5, -2.1),
                   ha="center", va="top", fontsize=6.5, weight="bold",
                   arrowprops=dict(arrowstyle="-|>", lw=0.9), zorder=9)

    # ---- детская зона
    sh.ax.add_patch(Arc(sh.T(0.3, 0.3), 70, 70, theta1=0, theta2=90, color="#d4a017", lw=1.2, zorder=4))
    sh.rect(0.7, 0.7, 2.1, 1.5, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    for cx in (1.0, 1.8):
        sh.chair(cx, 1.85, "n", a=0.32)
    sh.rect(0.45, 2.2, 0.85, 3.2, fc="#f6d6a8", ec=C_FURN_EDGE, z=3)
    sh.room_label(1.9, 2.75, "2.3", "Детская\nзона", 9.6, fs=SMALL_FS)

    # ---- мягкие зоны у витража
    for cx in (5.9, 9.4, 27.4):
        sh.lounge_group(cx)
    sh.text(7.65, 3.95, "Мягкая зона", fs=SMALL_FS, style="italic", color="#555")
    sh.text(27.4, 3.95, "Мягкая зона", fs=SMALL_FS, style="italic", color="#555")
    # островная мягкая зона
    sh.sofa(5.0, 4.8, 5.9, 7.0, back="w")
    sh.sofa(8.3, 4.8, 9.2, 7.0, back="e")
    sh.table(6.3, 5.3, 7.9, 6.5)
    sh.text(7.1, 7.35, "Мягкая зона", fs=SMALL_FS, style="italic", color="#555")

    # ---- бар / кофе-поинт
    sh.rect(0.3, 11.1, 4.3, 11.7, fc=C_FURN, ec=C_FURN_EDGE, z=3)      # задняя стойка
    sh.rect(0.9, 9.3, 4.3, 9.9, fc="#e2c9a0", ec=C_FURN_EDGE, z=3)      # барная стойка
    for cx in (1.5, 2.3, 3.1, 3.9):
        sh.ax.add_patch(Circle(sh.T(cx, 8.95), 1.7, facecolor=C_FURN, edgecolor=C_FURN_EDGE, lw=0.3, zorder=3))
    sh.room_label(2.4, 10.5, "3", "Бар / кофе-поинт", 12.6, fs=SMALL_FS)
    sh.cafe_table(2.4, 4.75)
    sh.cafe_table(2.4, 6.85)
    # медиастена на торце
    sh.rect(0.3, 3.9, 0.45, 8.3, fc="#555", z=5.2)
    sh.text(0.75, 6.1, "LED-экран / медиастена", fs=4.2, rotation=90, color="#444")

    # ---- зона макета
    sh.rect(12.5, 2.5, 18.5, 6.9, fc="#efe9dc", ec="#8a7d62", lw=0.6, z=2)
    sh.rect(13.1, 3.1, 17.9, 6.3, fc="white", ec="#8a7d62", lw=0.5, z=2.1)
    sh.rect(13.4, 3.4, 17.6, 6.0, fc="none", ec="#bdb29a", lw=0.3, z=2.2, ls="--")
    sh.room_label(15.5, 4.7, "2.1", "Зона макета\n(макет ЖК, подсветка)", 26.4)
    sh.dim_h([12.5, 18.5], 7.25, y_from=6.9, fs=4.6)
    sh.dim_v([2.5, 6.9], 12.1, x_from=12.5, fs=4.6)

    # ---- ресепшен
    sh.poly([(20.8, 4.3), (24.8, 4.3), (24.8, 5.1), (21.6, 5.1), (21.6, 6.3), (20.8, 6.3)],
            fc="#e2c9a0", ec=C_FURN_EDGE, lw=0.5, z=3)
    sh.chair(22.6, 5.65, "n")
    sh.chair(23.8, 5.65, "n")
    sh.room_label(22.8, 3.75, "2.2", "Ресепшен", 8.8, fs=SMALL_FS)

    # ---- кабинеты менеджеров (стекло h = 3.0 м)
    sh.glass(4.3, 8.5, 22.3, 8.5)
    for i in range(7):
        x = 4.3 + 3.0 * i
        sh.glass(x, 8.5, x, 11.7)
    for i in range(6):
        x0 = 4.3 + 3.0 * i
        c = x0 + 1.5
        sh.sliding_door(x0 + 0.25, 8.5, 0.9)
        sh.table(c - 0.8, 9.9, c + 0.8, 10.7)
        sh.chair(c - 0.4, 9.45, "s")
        sh.chair(c + 0.4, 9.45, "s")
        sh.chair(c, 11.0, "n")
        sh.rect(x0 + 0.15, 11.35, x0 + 2.85, 11.65, fc=C_FURN, ec=C_FURN_EDGE, lw=0.3, z=3)
        sh.text(c, 8.95, f"{4 + i}. Кабинет менеджера\n9.1 м²", fs=SMALL_FS - 0.3)
    sh.dim_h([4.3, 7.3], 8.1, y_from=8.45, fs=4.4)

    # ---- касса
    sh.wall(22.3, 8.5, 22.3, 11.7)
    sh.wall(25.3, 8.5, 25.3, 11.7)
    sh.wall(22.3, 8.5, 25.3, 8.5)
    sh.clear(23.3, 8.44, 24.3, 8.56)
    sh.rect(23.3, 8.46, 24.3, 8.54, fc=C_GLASS, ec=C_GLASS_EDGE, lw=0.3, z=6)
    sh.rect(22.4, 8.6, 25.2, 9.1, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    sh.chair(23.8, 9.5, "n")
    sh.rect(22.45, 11.0, 23.05, 11.6, fc="#888", ec="k", lw=0.3, z=3)
    sh.text(22.75, 10.8, "сейф", fs=3.8)
    sh.room_label(23.6, 10.4, "10", "Касса", 8.9, fs=SMALL_FS)
    sh.text(23.8, 8.15, "окно кассы", fs=3.8, color="#444")
    sh.door_in_wall(25.3, 10.9, (0, -1), (-1, 0), 0.9)

    # ---- сервисный блок под антресолью
    # VIP
    sh.glass(30, 0.3, 30, 5.0)
    sh.wall(35, 0.3, 35, 5.0)
    sh.wall(30, 5.0, 39.7, 5.0)
    sh.clear(29.94, 3.8, 30.06, 4.7)
    sh.door(30, 4.7, (0, -1), (1, 0), 0.9)
    sh.table(31.3, 2.05, 33.7, 3.15)
    for cx in (31.8, 32.5, 33.2):
        sh.chair(cx, 3.5, "n")
        sh.chair(cx, 1.7, "s")
    sh.chair(30.9, 2.6, "w")
    sh.chair(34.1, 2.6, "e")
    sh.room_label(32.5, 0.95, "11", "Сделочная / VIP-переговорная", 22.5, fs=SMALL_FS)
    # кухня / комната отдыха
    sh.rect(39.1, 0.8, 39.7, 3.8, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    sh.rect(39.1, 3.8, 39.7, 4.5, fc="#dcdcdc", ec=C_FURN_EDGE, z=3)
    sh.sink(39.4, 1.6)
    sh.table(36.4, 2.0, 37.8, 2.8)
    for cx in (36.8, 37.4):
        sh.chair(cx, 3.15, "n")
        sh.chair(cx, 1.65, "s")
    sh.sofa(35.2, 0.9, 36.0, 3.1, back="w", seats=2)
    sh.door_in_wall(38.0, 5.0, (1, 0), (0, -1), 0.9)
    sh.room_label(37.4, 4.05, "12", "Кухня / комната\nотдыха персонала", 21.4, fs=SMALL_FS)
    # коридор
    sh.room_label(35.3, 5.8, "13", "Коридор", 14.1, fs=SMALL_FS)
    sh.clear(39.64, 5.2, 40.06, 6.3)
    sh.door(40.0, 5.2, (0, 1), (1, 0), 1.1)
    sh.ax.annotate("Служебный\nвход", xy=sh.T(40.4, 5.75), xytext=sh.T(43.4, 3.9),
                   fontsize=5.5, ha="left", arrowprops=dict(arrowstyle="-|>", lw=0.6), zorder=9)
    # лестница (двухмаршевая, 2 x 10 подъёмов по 165 мм)
    sh.wall(32.8, 6.6, 32.8, 11.7)
    sh.glass(30, 7.7, 30, 11.7)
    for k in range(10):
        y = 7.7 + 0.3 * k
        sh.line([(30.1, y), (31.3, y)], color="k", lw=0.3, z=4)
        sh.line([(31.5, y), (32.7, y)], color="k", lw=0.3, z=4)
    sh.rect(30.1, 7.7, 31.3, 10.4, fc="none", ec="k", lw=0.4, z=4)
    sh.rect(31.5, 7.7, 32.7, 10.4, fc="none", ec="k", lw=0.4, z=4)
    sh.rect(31.3, 7.7, 31.5, 10.4, fc="#999", z=4)
    sh.line([(30.1, 9.3), (31.3, 9.7)], color="k", lw=0.6, z=4.2)            # линия обрыва
    sh.ax.annotate("", xy=sh.T(30.7, 10.2), xytext=sh.T(30.7, 7.9),
                   arrowprops=dict(arrowstyle="-|>", lw=0.6), zorder=6)
    sh.text(30.7, 7.35, "вверх", fs=4.0)
    sh.room_label(31.4, 11.05, "14", "Лестница", 14.1, fs=SMALL_FS - 0.4)
    # санузел посетителей
    sh.wall(32.8, 6.6, 39.7, 6.6)
    sh.wall(36.0, 6.6, 36.0, 11.7)
    sh.door_in_wall(32.95, 6.6, (1, 0), (0, 1), 0.9)
    sh.wall(32.8, 8.7, 36.0, 8.7, t=0.08)
    sh.wall(34.6, 8.7, 34.6, 11.7, t=0.08)
    sh.door_in_wall(33.0, 8.7, (1, 0), (0, 1), 0.9, t=0.08)
    sh.door_in_wall(34.75, 8.7, (1, 0), (0, 1), 0.7, t=0.08)
    sh.rect(35.4, 6.9, 35.93, 8.4, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    sh.sink(35.65, 7.3)
    sh.sink(35.65, 8.0)
    sh.wc(33.7, 11.25, "s")
    sh.wc(35.3, 11.25, "s")
    sh.text(33.7, 10.3, "МГН", fs=4.0)
    sh.room_label(34.1, 7.7, "15", "С/у посетителей", 15.3, fs=SMALL_FS - 0.4)
    # санузел персонала с душем
    sh.wall(37.8, 6.6, 37.8, 11.7)
    sh.door_in_wall(36.2, 6.6, (1, 0), (0, 1), 0.8)
    sh.sink(37.5, 7.6)
    sh.rect(36.1, 9.3, 37.7, 10.3, fc="#eef", ec=C_FURN_EDGE, z=3)
    sh.line([(36.1, 9.3), (37.7, 10.3)], color=C_FURN_EDGE, lw=0.25, z=3.2)
    sh.line([(36.1, 10.3), (37.7, 9.3)], color=C_FURN_EDGE, lw=0.25, z=3.2)
    sh.wc(36.9, 11.25, "s")
    sh.room_label(36.9, 8.55, "16", "С/у\nперсонала\n(душ)", 8.3, fs=SMALL_FS - 0.6)
    # КУИ и электрощитовая
    sh.wall(37.8, 9.0, 39.7, 9.0)
    sh.door_in_wall(38.0, 6.6, (1, 0), (0, 1), 0.8)
    sh.room_label(38.8, 8.2, "17", "КУИ", 4.1, fs=SMALL_FS - 0.6)
    sh.room_label(38.75, 10.4, "18", "Электро-\nщитовая", 4.8, fs=SMALL_FS - 0.6)
    sh.clear(39.64, 9.6, 40.06, 10.5)
    sh.door(40.0, 9.6, (0, 1), (1, 0), 0.9)

    # ---- надпись зала
    sh.text(15.5, 7.95, "2. ЗАЛ ПРОДАЖ — второй свет, h = 6.5–7.0 м    253.1 м²", fs=6.3, weight="bold",
            color="#5a4a2a")
    sh.text(27.7, 9.8, "проход к кассе,\nс/у и лестнице\nна антресоль", fs=4.3, color="#555", style="italic")

    # ---- нижние размеры зон
    sh.dim_h([0, 30, 40], -1.15, y_from=-0.05,
             labels=["30000 — зал продаж со вторым светом (75%)", "10000 — сервисный блок + антресоль (25%)"])

    # ---- дорога
    sh.rect(-3, -3.2, 43, -7.2, fc="#8c8c8c", z=0.5)
    sh.rect(-3, -1.9, 43, -3.2, fc="#d9d9d9", z=0.5)
    sh.line([(-3, -5.2), (43, -5.2)], color="white", lw=1.0, ls=(0, (10, 6)), z=0.6)
    sh.text(8, -6.2, "ДОРОГА", fs=10, color="white", weight="bold")
    sh.text(33, -2.55, "тротуар / благоустройство", fs=5.5, color="#444")

    # ---- экспликация
    rows = [
        ("1", "Тамбур", "5.4"),
        ("2", "Зал продаж (второй свет h 6.5–7.0 м), в т.ч.:", "253.1"),
        ("2.1", "   зона макета", "26.4"),
        ("2.2", "   ресепшен", "8.8"),
        ("2.3", "   детская зона", "9.6"),
        ("", "   мягкие зоны (4 шт.)", "—"),
        ("3", "Бар / кофе-поинт", "12.6"),
        ("4–9", "Кабинеты менеджеров, 6 шт. × 9.1", "54.6"),
        ("10", "Касса", "8.9"),
        ("11", "Сделочная / VIP-переговорная", "22.5"),
        ("12", "Кухня / комната отдыха персонала", "21.4"),
        ("13", "Коридор", "14.1"),
        ("14", "Лестница на антресоль", "14.1"),
        ("15", "С/у посетителей (в т.ч. МГН)", "15.3"),
        ("16", "С/у персонала с душем", "8.3"),
        ("17", "КУИ (уборочный инвентарь)", "4.1"),
        ("18", "Электрощитовая", "4.8"),
        ("", "ИТОГО 1-й этаж (полезная)", "439.2"),
    ]
    sh.table_block(25, 147, "Экспликация помещений 1-го этажа", rows)

    notes = [
        "Примечания",
        "1. Здание 40.0 × 12.0 м по наружным граням, площадь застройки 480 м². Витражный фасад — вдоль дороги.",
        "2. Зал продаж 30 × 12 м — двусветное пространство высотой 6.5–7.0 м (75% площади).",
        "3. Сервисный блок 10 × 12 м (25%): под антресолью h = 3.0 м, над ним антресоль бэк-офиса",
        "    на отм. +3.300, h = 3.7 м (см. лист 2).",
        "4. Кабинеты менеджеров — стеклянные перегородки h = 3.0 м, раздвижные двери; над кабинетами",
        "    на задней стене — место под брендинг / медиаэкран (отм. +3.5…+6.0).",
        "5. Шаг колонн 5.0 м, пролёт 12 м без промежуточных опор (уточняется расчётом КР).",
        "6. Наполнение взято из исходного проекта: бар, ресепшен, детская зона, зона макета,",
        "    кабинеты менеджеров, касса, кухня, комната отдыха, санузлы, лестница, переговорные.",
        "7. Эвакуационные выходы, МГН, вентиляция и инженерные сети — уточнить на стадии «П».",
    ]
    for i, s in enumerate(notes):
        sh.ptext(185, 143 - i * 5.2, s, fs=6.6 if i else 7.5, weight="bold" if i == 0 else "normal")

    legend(sh, 185, 78)
    sh.save(pdf, os.path.join(HERE, "sheet1_floor1.png"))


def legend(sh, x0, y0):
    items = [
        (C_HALL, "Клиентская зона (второй свет)"),
        (C_CAB, "Кабинеты менеджеров"),
        (C_CLIENT, "Переговорные с клиентами"),
        (C_BACK, "Бэк-офис"),
        (C_SERV, "Служебные помещения"),
        (C_WC, "Санузлы"),
    ]
    sh.ptext(x0, y0, "Условные обозначения", fs=7.5, weight="bold")
    for i, (c, s) in enumerate(items):
        yy = y0 - 6 - i * 5
        sh.ax.add_patch(Rectangle((x0, yy - 1.8), 8, 3.6, facecolor=c, edgecolor="k", lw=0.3, zorder=9))
        sh.ptext(x0 + 11, yy, s, fs=6.3)
    x1 = x0 + 95
    sym = [("wall", "Наружная стена"), ("glass", "Витраж / стеклянная перегородка"),
           ("col", "Колонна"), ("part", "Перегородка")]
    for i, (k, s) in enumerate(sym):
        yy = y0 - 6 - i * 5
        if k == "wall":
            sh.ax.add_patch(Rectangle((x1, yy - 1.5), 8, 3, facecolor=C_WALL, zorder=9))
        elif k == "glass":
            sh.ax.add_patch(Rectangle((x1, yy - 1), 8, 2, facecolor=C_GLASS, edgecolor=C_GLASS_EDGE, lw=0.3, zorder=9))
        elif k == "col":
            sh.ax.add_patch(Rectangle((x1 + 2, yy - 2), 4, 4, facecolor="#1f1f1f", zorder=9))
        else:
            sh.ax.add_patch(Rectangle((x1, yy - 0.75), 8, 1.5, facecolor=C_WALL, zorder=9))
        sh.ptext(x1 + 11, yy, s, fs=6.3)


# ============================================================ ЛИСТ 2
def sheet2(pdf):
    sh = Sheet()
    sh.frame("ОФИС ПРОДАЖ 40 × 12 м — ПЛАН АНТРЕСОЛИ (отм. +3.300) И РАЗРЕЗ 1-1", 2,
             "План антресоли (бэк-офис), разрез 1-1")

    # второй свет над залом
    sh.rect(0.3, 0.3, 30, 11.7, fc="#fafafa", z=0.8)
    sh.line([(0.3, 0.3), (30, 11.7)], color=C_GHOST, lw=0.5, z=1, ls="--")
    sh.line([(0.3, 11.7), (30, 0.3)], color=C_GHOST, lw=0.5, z=1, ls="--")
    # силуэты мебели зала (вид сверху)
    for i in range(6):
        x0 = 4.3 + 3.0 * i
        sh.rect(x0, 8.5, x0 + 3.0, 11.7, fc="none", ec=C_GHOST, lw=0.4, z=1.1, ls=":")
    sh.rect(22.3, 8.5, 25.3, 11.7, fc="none", ec=C_GHOST, lw=0.4, z=1.1, ls=":")
    sh.rect(12.5, 2.5, 18.5, 6.9, fc="none", ec=C_GHOST, lw=0.5, z=1.1, ls=":")
    sh.rect(21.2, 0.3, 23.8, 2.5, fc="none", ec=C_GHOST, lw=0.4, z=1.1, ls=":")
    sh.text(15.15, 9.0, "ВТОРОЙ СВЕТ", fs=12, weight="bold", color="#9a9a9a",
            bbox=dict(facecolor="#fafafa", edgecolor="none", pad=1.5))
    sh.text(15.15, 7.9, "над залом продаж (пол отм. 0.000, высота зала 6.5–7.0 м)\n"
                        "пунктиром — стеклянные кабинеты h 3.0 м, зона макета и тамбур внизу",
            fs=5.6, color="#8a8a8a", bbox=dict(facecolor="#fafafa", edgecolor="none", pad=1.2))

    # помещения антресоли — заливки
    sh.rect(30, 0.3, 34.6, 5.0, fc=C_CLIENT)
    sh.rect(34.6, 0.3, 39.7, 5.0, fc=C_BACK)
    sh.rect(30, 5.0, 39.7, 6.6, fc="#f4f4f4")
    sh.rect(30, 6.6, 32.8, 7.7, fc="#f4f4f4")
    sh.rect(32.8, 6.6, 38.0, 11.7, fc=C_BACK)
    sh.rect(38.0, 6.6, 39.7, 11.7, fc=C_SERV)
    # край перекрытия антресоли
    sh.line([(30, 0.3), (30, 11.7)], color="k", lw=0.9, z=4.5)

    shell(sh, 1)

    # переговорная
    sh.glass(30, 0.3, 30, 5.0)
    sh.wall(34.6, 0.3, 34.6, 5.0)
    sh.wall(30, 5.0, 39.7, 5.0)
    sh.door_in_wall(31.2, 5.0, (1, 0), (0, -1), 0.9)
    sh.table(30.9, 2.1, 33.7, 3.2)
    for cx in (31.4, 32.3, 33.2):
        sh.chair(cx, 3.55, "n")
        sh.chair(cx, 1.75, "s")
    sh.chair(30.5, 2.65, "w")
    sh.chair(34.1, 2.65, "e")
    sh.room_label(32.3, 0.95, "1", "Переговорная (вид на зал)", 20.7, fs=SMALL_FS)
    # кабинет руководителя
    sh.door_in_wall(35.0, 5.0, (1, 0), (0, -1), 0.9)
    sh.table(36.6, 1.3, 38.6, 2.2)
    sh.chair(37.6, 2.6, "n")
    sh.chair(37.2, 0.9, "s")
    sh.chair(38.0, 0.9, "s")
    sh.sofa(38.8, 2.6, 39.6, 4.6, back="e", seats=2)
    sh.table(37.6, 3.2, 38.4, 4.0)
    sh.rect(34.75, 0.5, 35.15, 3.5, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    sh.room_label(36.7, 4.25, "2", "Кабинет руководителя", 23.2, fs=SMALL_FS)
    # холл-галерея
    sh.glass(30, 5.0, 30, 11.7)
    sh.room_label(35.3, 5.8, "3", "Холл-галерея", 17.3, fs=SMALL_FS)
    sh.text(29.35, 6.3, "стеклянное\nограждение\nh 1.1 м,\nвид на зал", fs=4.0, color=C_GLASS_EDGE,
            ha="right")
    # проём лестницы
    sh.wall(32.8, 6.6, 32.8, 11.7)
    sh.glass(30, 7.7, 31.4, 7.7)
    sh.rect(30.05, 7.7, 32.73, 11.65, fc="white", z=1.2)
    for k in range(10):
        y = 7.7 + 0.3 * k
        sh.line([(30.1, y), (31.3, y)], color="k", lw=0.3, z=4)
        sh.line([(31.5, y), (32.7, y)], color="k", lw=0.3, z=4)
    sh.rect(30.1, 7.7, 31.3, 10.4, fc="none", ec="k", lw=0.4, z=4)
    sh.rect(31.5, 7.7, 32.7, 10.4, fc="none", ec="k", lw=0.4, z=4)
    sh.rect(31.3, 7.7, 31.5, 10.4, fc="#999", z=4)
    sh.line([(30.1, 7.7), (32.7, 11.65)], color="#999", lw=0.3, z=4, ls="--")
    sh.ax.annotate("", xy=sh.T(32.1, 7.85), xytext=sh.T(32.1, 10.2),
                   arrowprops=dict(arrowstyle="-|>", lw=0.6), zorder=6)
    sh.text(31.4, 11.05, "проём\nлестницы", fs=4.2)
    sh.text(32.1, 7.35, "вниз", fs=4.0)
    # open-space
    sh.wall(32.8, 6.6, 39.7, 6.6)
    sh.wall(38.0, 6.6, 38.0, 11.7)
    sh.door_in_wall(33.1, 6.6, (1, 0), (0, 1), 0.9)
    for row_y, back in ((8.95, "s"), (9.65, "n")):
        for cx in (34.0, 35.45, 36.9):
            sh.table(cx - 0.7, row_y - 0.35, cx + 0.7, row_y + 0.35)
            sh.chair(cx, row_y - 0.7 if back == "s" else row_y + 0.7, back)
    sh.rect(33.0, 11.25, 37.85, 11.65, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    sh.room_label(35.45, 7.6, "4", "Бэк-офис open-space (6 мест):\nбухгалтерия, юрист, CRM, маркетинг", 25.4,
                  fs=SMALL_FS - 0.3)
    # архив / серверная
    sh.door_in_wall(38.2, 6.6, (1, 0), (0, 1), 0.8)
    sh.rect(39.2, 7.8, 39.65, 11.6, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    sh.rect(38.1, 11.2, 39.2, 11.65, fc=C_FURN, ec=C_FURN_EDGE, z=3)
    sh.room_label(38.65, 9.4, "5", "Архив /\nсерверная", 8.2, fs=SMALL_FS - 0.4)

    sh.dim_h([0, 30, 40], -1.15, y_from=-0.05,
             labels=["30000 — второй свет (75%)", "10000 — антресоль 120 м² брутто (25%)"])

    # экспликация антресоли
    rows = [
        ("1", "Переговорная (стекло на зал)", "20.7"),
        ("2", "Кабинет руководителя", "23.2"),
        ("3", "Холл-галерея с видом на зал", "17.3"),
        ("4", "Бэк-офис open-space, 6 мест", "25.4"),
        ("5", "Архив / серверная", "8.2"),
        ("", "Проём лестницы", "10.9"),
        ("", "ИТОГО антресоль (полезная)", "94.8"),
        ("", "Антресоль брутто / доля от 480 м²", "120 / 25%"),
    ]
    sh.table_block(25, 212, "Экспликация антресоли (отм. +3.300)", rows, widths=(10, 100, 30))
    notes = [
        "Примечания",
        "1. Антресоль 10 × 12 м = 120 м² брутто (25% от 480 м²), полезная 94.8 м² (≈20%).",
        "2. Отм. пола антресоли +3.300; высота помещений антресоли 3.7 м (до низа покрытия +7.000).",
        "3. Край антресоли по оси 7 — стеклянное ограждение h 1.1 м и стеклянная стена переговорной:",
        "    бэк-офис и переговорная получают вид на зал и макет.",
        "4. Лестница двухмаршевая, 2 × 10 подъёмов (165 × 300 мм), ширина марша 1.2 м.",
        "5. Колонны антресоли — по осям 7 и 8 (сечения и перекрытие — по расчёту КР).",
    ]
    for i, s_ in enumerate(notes):
        sh.ptext(185, 208 - i * 5.2, s_, fs=6.6 if i else 7.5, weight="bold" if i == 0 else "normal")
    legend(sh, 420, 208)

    section(sh)
    sh.save(pdf, os.path.join(HERE, "sheet2_mezzanine.png"))


def section(sh):
    """Разрез 1-1 по оси Y = 6.0 м, вид в сторону задней стены."""
    sox, soy = OX, 62
    ssh = Sheet.__new__(Sheet)
    ssh.fig, ssh.ax, ssh.ox, ssh.oy = sh.fig, sh.ax, sox, soy

    # грунт, пол
    ssh.rect(-1.5, -0.8, 41.5, -0.3, fc="#e9e2d0", ec="none", z=0.5, hatch="////")
    ssh.rect(0, -0.3, 40, 0, fc=C_WALL, z=5)
    # торцевые стены + парапет
    ssh.rect(0, 0, 0.3, 8.0, fc=C_WALL, z=5)
    ssh.rect(39.7, 0, 40, 8.0, fc=C_WALL, z=5)
    # покрытие
    ssh.rect(0.3, 7.0, 39.7, 7.4, fc=C_WALL, z=5)
    for i in range(40):
        x = 0.3 + i * (39.4 / 40)
        ssh.line([(x, 7.0), (x + 39.4 / 80, 7.0 - 0.0)], color="#777", lw=0.2, z=4)
    # колонны задней стены (вид)
    for x in COL_X[1:-1]:
        ssh.rect(x - 0.2, 0, x + 0.2, 7.0, fc="#dcdcdc", ec="#777", lw=0.3, z=1)
    # антресоль (разрез)
    ssh.rect(30, 3.0, 39.7, 3.3, fc=C_WALL, z=5)
    ssh.rect(29.85, 0, 30.15, 3.0, fc="#bbb", ec="#555", lw=0.3, z=2)          # колонна (вид)
    ssh.rect(29.97, 3.3, 30.03, 4.4, fc=C_GLASS, ec=C_GLASS_EDGE, lw=0.4, z=5)  # ограждение
    ssh.line([(29.9, 4.4), (30.3, 4.4)], color=C_GLASS_EDGE, lw=0.8, z=5)
    # стены за коридорами (вид) с дверями
    ssh.rect(32.8, 0, 39.7, 3.0, fc="#f1f1f1", ec="#777", lw=0.3, z=1.5)
    ssh.rect(32.8, 3.3, 39.7, 7.0, fc="#f1f1f1", ec="#777", lw=0.3, z=1.5)
    for x0, w in ((32.95, 0.9), (36.2, 0.8), (38.0, 0.8)):
        ssh.rect(x0, 0, x0 + w, 2.1, fc="white", ec="#555", lw=0.4, z=2)
    for x0, w in ((33.1, 0.9), (38.2, 0.8)):
        ssh.rect(x0, 3.3, x0 + w, 5.4, fc="white", ec="#555", lw=0.4, z=2)
    # лестница (вид с торца маршей)
    for k in range(10):
        ssh.line([(30.1, 0.165 * k), (31.3, 0.165 * k)], color="#555", lw=0.25, z=2.5)
        ssh.line([(31.5, 1.65 + 0.165 * k), (32.7, 1.65 + 0.165 * k)], color="#555", lw=0.25, z=2.5)
    ssh.rect(30.1, 0, 31.3, 1.65, fc="none", ec="#333", lw=0.4, z=2.6)
    ssh.rect(31.5, 1.65, 32.7, 3.3, fc="none", ec="#333", lw=0.4, z=2.6)
    ssh.rect(30.1, 1.55, 32.7, 1.65, fc="#999", z=2.6)
    # кабинеты (вид), касса, бар
    for i in range(6):
        x0 = 4.3 + 3.0 * i
        ssh.rect(x0, 0, x0 + 3.0, 3.0, fc="#e6f3fb", ec=C_GLASS_EDGE, lw=0.5, z=2)
        ssh.rect(x0 + 0.25, 0, x0 + 1.15, 2.2, fc="none", ec=C_GLASS_EDGE, lw=0.3, z=2.1)
    ssh.rect(22.3, 0, 25.3, 3.0, fc="#dedede", ec="#555", lw=0.5, z=2)
    ssh.rect(23.3, 0.9, 24.3, 1.5, fc=C_GLASS, ec=C_GLASS_EDGE, lw=0.3, z=2.1)
    ssh.rect(0.9, 0, 4.3, 1.1, fc="#e2c9a0", ec="#555", lw=0.4, z=2)
    ssh.rect(8.0, 3.6, 18.5, 6.0, fc="none", ec="#6a3d9a", lw=0.5, z=2, ls="--")
    ssh.text(13.25, 4.8, "брендинг / медиаэкран на задней стене", fs=4.8, color="#6a3d9a")
    # элементы в плоскости разреза: макет, островной диван
    ssh.rect(12.5, 0, 18.5, 0.9, fc="#c9bfa6", ec="#555", lw=0.5, z=3)
    ssh.rect(13.4, 0.9, 17.6, 1.3, fc="#efe9dc", ec="#8a7d62", lw=0.4, z=3)
    ssh.text(15.5, 1.75, "макет", fs=4.8)
    ssh.rect(5.0, 0, 5.9, 0.8, fc="#bbb", ec="#555", lw=0.4, z=3)
    ssh.rect(8.3, 0, 9.2, 0.8, fc="#bbb", ec="#555", lw=0.4, z=3)

    # человечки для масштаба
    for (x, z0) in ((10.5, 0), (26.5, 0), (36.4, 3.3), (35.0, 0)):
        ssh.ax.add_patch(Circle(ssh.T(x, z0 + 1.62), 1.1, facecolor="none", edgecolor="#333", lw=0.4, zorder=6))
        ssh.line([(x, z0 + 1.5), (x, z0 + 0.85)], color="#333", lw=0.5, z=6)
        ssh.line([(x - 0.2, z0), (x, z0 + 0.85), (x + 0.2, z0)], color="#333", lw=0.5, z=6)
        ssh.line([(x - 0.25, z0 + 1.0), (x, z0 + 1.35), (x + 0.25, z0 + 1.0)], color="#333", lw=0.5, z=6)

    # подписи зон
    ssh.text(15.5, 6.55, "ЗАЛ ПРОДАЖ — ВТОРОЙ СВЕТ", fs=7, weight="bold", color="#5a4a2a")
    ssh.text(35.0, 5.9, "антресоль — бэк-офис", fs=5.2, weight="bold", color="#6a3d9a")
    ssh.text(35.3, 2.55, "сервисный блок", fs=5.2, weight="bold", color="#555")

    # размеры высот
    ssh.dim_v([0, 7.0], 27.9, labels=["7000 (чистая высота зала 6.5–7.0 м)"])
    ssh.dim_v([0, 3.0, 3.3, 7.0, 7.4, 8.0], 41.3, x_from=40.05)
    ssh.dim_h([0, 30, 40], -1.6, labels=["30000", "10000"])
    # отметки уровней
    for z, lab in ((0, "±0.000"), (3.0, "+3.000"), (3.3, "+3.300"), (7.0, "+7.000"), (8.0, "+8.000")):
        px, py = ssh.T(-0.2, z)
        ssh.ax.plot([px - 20, px], [py, py], color="k", lw=0.3, zorder=7)
        ssh.ax.add_patch(Polygon([(px - 14, py), (px - 15.6, py + 1.8), (px - 12.4, py + 1.8)],
                                 closed=True, facecolor="k", zorder=7))
        below = z == 3.0
        ssh.ax.text(px - 20, py - 1.0 if below else py + 2.4, lab, fontsize=5.2, ha="left",
                    va="top" if below else "bottom", zorder=9)
    ssh.ptext(sox, soy + 8.9 * S, "Разрез 1-1", fs=10, weight="bold")


def main():
    out = os.path.join(HERE, "office_plan.pdf")
    with PdfPages(out) as pdf:
        sheet1(pdf)
        sheet2(pdf)
    print("saved", out)


if __name__ == "__main__":
    main()
