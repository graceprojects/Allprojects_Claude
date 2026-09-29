/* Офис продаж: база знаний, генератор планировки и проверки норм.
 * Один файл для двух потребителей:
 *   - планировщик (index.html) — встраивается между маркерами KB:BEGIN / KB:END (build.py);
 *   - скилл Claude (.claude/skills/sales-office-planning/scripts) — через Node: require('./office-kb.js').
 * Координаты — метры, X вдоль дороги, Y вглубь (Y = D — витражный фасад у дороги).
 * Площади — в чистоте. Числа — ориентиры для эскиза заказчика, окончательно проверяет проектировщик.
 */
(function (root) {
  "use strict";
  const KB = { version: "1.1" };

  KB.CAT = {
    client: { n: "Клиентская зона", c: "#F3E6CF" }, office: { n: "Кабинеты продаж", c: "#DAE8F6" },
    meet: { n: "Переговорные", c: "#F7D9C2" }, back: { n: "Бэк-офис", c: "#E5DBF2" },
    staff: { n: "Помещения персонала", c: "#E0ECD8" }, service: { n: "Служебные / технические", c: "#E2E2DC" },
    wc: { n: "Санузлы", c: "#D3EEEA" }, circ: { n: "Коммуникации", c: "#EDEDE6" },
  };
  // Зоны приватности: от входа вглубь и снизу вверх
  KB.ZONES = { public: "Публичная", semi: "Полупубличная", private: "Закрытая клиентская", service: "Служебная" };

  // Размеры мебели, которую ставит генератор (w × h, м) — совпадают с каталогом планировщика
  const DIMS = {
    door9: [.9, 1.2], door18: [1.8, 1.2], slide: [1, .3], recep: [3, .8], model: [5, 3], lounge: [2.2, 2.9],
    kidtab: [1, .6], kidmat: [2, 2], led: [2, .2], plant: [.6, .6], cooler: [.35, .35], work3: [1.6, 2.3],
    deskB: [1.8, .9], chairO: [.6, .6], chairV: [.5, .5], os4: [2.8, 2.6], os1: [1.4, 1.3], cab: [.9, .45], shelf: [1, .4],
    safe: [.5, .5], desk: [1.6, .8], meet6: [2.4, 2.1], meet8: [3.2, 2.2], kitch: [2.4, .6], fridge: [.7, .7],
    dine: [1.9, 1.9], bar: [3, .6], stool: [.45, .45], wc: [.4, .7], sink: [.55, .45], cubicle: [1.2, 1.8],
    stair2: [2.6, 4], mfp: [.6, .5], sofa2: [1.6, .9], stand: [1.2, .4],
  };

  // Каталог мебели и оборудования: key, название, группа, w, h (глубина), z (высота 3D, "H" — до потолка), тип символа, цвет 3D
  KB.FURN = [
    // проёмы
    ["door9","Дверь 900","Двери и окна",.9,1.2,2.1,"door","#9a7b56"],["door10","Дверь 1000","Двери и окна",1,1.3,2.1,"door","#9a7b56"],
    ["door18","Дверь двустворчатая 1800","Двери и окна",1.8,1.2,2.4,"door2","#9a7b56"],["slide","Дверь раздвижная 1000","Двери и окна",1,.3,2.4,"slide","#a9d3ee"],
    ["auto","Автоматическая дверь 2000","Двери и окна",2,.3,2.6,"auto","#a9d3ee"],["win","Окно 1500","Двери и окна",1.5,.3,1.5,"win","#a9d3ee"],
    // клиентская зона
    ["recep","Стойка ресепшен","Клиентская зона",3,.8,1.1,"recep","#d9c19a"],["recepL","Стойка ресепшен угловая","Клиентская зона",2.6,1.8,1.1,"recepL","#d9c19a"],
    ["model","Стол макета ЖК 5×3","Клиентская зона",5,3,.9,"model","#e9e2d2"],["modelS","Стол макета 3×2","Клиентская зона",3,2,.9,"model","#e9e2d2"],
    ["lounge","Мягкая зона (диван+2 кресла)","Клиентская зона",2.2,2.9,.8,"lounge","#c9c4bb"],
    ["sofa2","Диван 2-местный","Клиентская зона",1.6,.9,.8,"sofa","#b9b2a6"],["sofa3","Диван 3-местный","Клиентская зона",2.2,.9,.8,"sofa","#b9b2a6"],
    ["arm","Кресло","Клиентская зона",.8,.8,.8,"arm","#b9b2a6"],["ctab","Журнальный столик","Клиентская зона",1.2,.6,.45,"table","#e0d6c6"],
    ["bench","Банкетка","Клиентская зона",1.2,.45,.45,"table","#b9b2a6"],["cafe4","Стол кафе на 4","Клиентская зона",1.9,1.9,.75,"cafe4","#e0d6c6"],
    ["led","LED-экран / ТВ","Клиентская зона",2,.2,1.2,"screen","#2b2f33"],["media","Медиастена 4 м","Клиентская зона",4,.3,2.5,"screen","#2b2f33"],
    ["stand","Стенд с планировками","Клиентская зона",1.2,.4,2,"stand","#f1efe9"],["plant","Растение в кашпо","Клиентская зона",.6,.6,1.4,"plant","#5d8c4e"],
    ["cooler","Кулер","Клиентская зона",.35,.35,1.1,"cooler","#e6eef3"],["kidtab","Детский столик","Клиентская зона",1,.6,.5,"kidtab","#f2b76a"],
    ["kidmat","Игровой коврик","Клиентская зона",2,2,.05,"mat","#f4d36b"],
    // кабинеты
    ["work3","Рабочее место менеджера + 2 гостя","Офисная мебель",1.6,2.3,.75,"work3","#e8e2d6"],["desk","Стол менеджера 1600","Офисная мебель",1.6,.8,.75,"table","#e8e2d6"],
    ["deskB","Стол руководителя 1800","Офисная мебель",1.8,.9,.75,"table","#8c6a4a"],["os1","Рабочее место open-space","Офисная мебель",1.4,1.3,.75,"os1","#e8e2d6"],
    ["os4","Блок open-space на 4","Офисная мебель",2.8,2.6,.75,"os4","#e8e2d6"],["chairO","Кресло офисное","Офисная мебель",.6,.6,1,"chair","#3c4146"],
    ["chairV","Стул посетителя","Офисная мебель",.5,.5,.85,"chair","#6b7075"],["cab","Шкаф для документов","Офисная мебель",.9,.45,2,"cab","#dcd6cb"],
    ["shelf","Стеллаж архивный","Офисная мебель",1,.4,2.2,"shelf","#c9c4ba"],["safe","Сейф","Офисная мебель",.5,.5,1.2,"safe","#55595c"],
    ["mfp","МФУ / принтер","Офисная мебель",.6,.5,1,"mfp","#d8dbdd"],
    // переговоры
    ["meet6","Стол переговоров на 6","Переговорные",2.4,2.1,.75,"meet","#d8cdb8"],["meet8","Стол переговоров на 8","Переговорные",3.2,2.2,.75,"meet","#d8cdb8"],
    ["meet10","Стол переговоров на 10","Переговорные",4,2.2,.75,"meet","#d8cdb8"],["round4","Круглый стол на 4","Переговорные",1.9,1.9,.75,"cafe4","#d8cdb8"],
    // кухня и бар
    ["kitch","Кухонный гарнитур 2.4 м","Кухня и бар",2.4,.6,.9,"kitch","#e9e6df"],["fridge","Холодильник","Кухня и бар",.7,.7,1.9,"fridge","#e9ecee"],
    ["bar","Барная стойка 3 м","Кухня и бар",3,.6,1.1,"bar","#c8a877"],["stool","Барный стул","Кухня и бар",.45,.45,.75,"stool","#555"],
    ["dine","Обеденный стол на 4","Кухня и бар",1.9,1.9,.75,"cafe4","#e0d6c6"],
    // сантехника
    ["wc","Унитаз","Сантехника",.4,.7,.8,"toilet","#f4f4f2"],["sink","Раковина","Сантехника",.55,.45,.85,"sink","#f4f4f2"],
    ["urinal","Писсуар","Сантехника",.4,.35,1,"urinal","#f4f4f2"],["shower","Душевой поддон","Сантехника",.9,.9,2,"shower","#dbe9f0"],
    ["cubicle","Кабина с/у 1.2×1.8","Сантехника",1.2,1.8,2.1,"cubicle","#c7d7da"],
    // конструкции
    ["col","Колонна 400×400","Конструкции",.4,.4,"H","col","#8f928d"],["col3","Колонна 300×300","Конструкции",.3,.3,"H","col","#8f928d"],
    ["stair2","Лестница двухмаршевая","Конструкции",2.6,4,3.3,"stair2","#b9b6ae"],["stair1","Лестница одномаршевая","Конструкции",1.2,5.7,3.3,"stair1","#b9b6ae"],
  ];
  KB.FK = Object.fromEntries(KB.FURN.map(f => [f[0], { k: f[0], n: f[1], g: f[2], w: f[3], h: f[4], z: f[5], d: f[6], c: f[7] }]));

  KB.DEFAULTS = {
    name: "Офис продаж", w: 40, d: 12, h: 7, M: 6, B: 6, maket: "5x3",
    kids: true, cafe: true, wardrobe: true, bank: true, cashier: false, media: false, showroom: false,
    director: true, mezz: "auto", front: "vitrage",
  };
  KB.MAKET = { "2x1.5": [2, 1.5], "3x2": [3, 2], "5x3": [5, 3], "6x4": [6, 4] };

  /* ------------------------------------------------------------ пакеты офиса продаж по площади
   * Каждый пакет — таблица строк программы. Количество (n) и площадь (area) могут быть формулами.
   * Переменные формул: A — площадь офиса (м², внутри стен), M — менеджеров (мест консультаций), B — бэк-офис,
   * seats — мест ожидания; функции: min, max, round, ceil, floor, clamp(x, a, b).
   * status: «обязательно» — всегда; «желательно» — включено, можно выключить; «опция» — выключено, можно включить.
   */
  KB.PACKAGES = {
    S: { name: "Мини", sub: "80–150 м²", min: 80, max: 150, A: 100, k: 1.3, depth: 10, h: 3.6, compact: true, gap: 0.9,
      vars: { M: "A <= 115 ? 2 : 3", B: "A <= 115 ? 1 : 2", seats: "max(4, 2 * M)", maket: "A <= 115 ? '2x1.5' : '3x2'" },
      about: "Павильон или помещение на первом этаже. Открытые места консультаций, одна переговорная-сделочная, один универсальный санузел, мини-кухня.",
      rows: [
        { key: "tambour", name: "Тамбур", zone: "public", cat: "circ", n: "1", w: 2.4, h: 2.5, border: "glass", status: "опция", rule: "по умолчанию — тепловая завеса над входом; тамбур глубиной ≥ 2,45 м для МГН", sub: true },
        { key: "reception", name: "Ресепшен / хостес", zone: "public", cat: "client", n: "1", w: 1.8, h: 1.6, border: "none", sub: true, rule: "стойка 1,2–1,4 м у входа; можно совместить с местом консультации" },
        { key: "lounge", name: "Зона ожидания", zone: "public", cat: "client", n: "1", area: "max(6, seats * 1.6)", border: "none", sub: true, rule: "диван + кресла, вешалка; 1,6 м² на место" },
        { key: "cafe", name: "Кофе-корнер", zone: "public", cat: "client", n: "1", w: 2, h: 1.5, border: "none", status: "желательно", color: "#D9B98E", rule: "стойка с кофемашиной и кулером" },
        { key: "maket", name: "Зона макета / экран", zone: "public", cat: "client", n: "1", area: "maketArea", border: "none", sub: true, rule: "стол 2×1,5 (до 115 м²) или 3×2 + обход 0,9 м; можно заменить большим экраном" },
        { key: "kids", name: "Детский уголок", zone: "public", cat: "client", n: "1", w: 2, h: 2, border: "none", sub: true, status: "опция", color: "#F4D36B", rule: "коврик и столик в поле зрения родителей" },
        { key: "cabinet", name: "Место консультации", zone: "semi", cat: "office", n: "M", w: 2.8, h: 2.6, border: "none", color: "#DAE8F6", rule: "открытый стол менеджера + 2 кресла клиента, 7,3 м²" },
        { key: "vip", name: "Переговорная-сделочная на 4", zone: "private", cat: "meet", n: "1", area: "9", border: "glass", color: "#A8784E", rule: "закрытая, для подписания договоров, 3×3 м" },
        { key: "wcv", name: "Санузел универсальный (МГН)", zone: "public", cat: "wc", n: "1", area: "5", color: "#CFE8E6", rule: "один на посетителей и персонал (допустимо при ≤ 10 чел.), 2,20×2,25 м" },
        { key: "kitchen", name: "Мини-кухня / приём пищи", zone: "service", cat: "staff", n: "1", area: "6", rule: "место 6 м² при ≤ 10 работающих (СП 44, сверить)" },
        { key: "backoffice", name: "Рабочее место бэк-офиса", zone: "service", cat: "back", n: "1", area: "max(4.5, B * 4.5)", rule: "4,5 м² на место с ПК" },
        { key: "kui", name: "Шкаф уборочного инвентаря", zone: "service", cat: "service", n: "1", w: 1, h: 1, rule: "встроенный шкаф с раковиной или в санузле" },
        { key: "elec", name: "Электрощит и слаботочка", zone: "service", cat: "service", n: "1", w: 1.2, h: 1.5, rule: "шкаф ЩР + серверная стойка" },
      ] },
    M: { name: "Стандарт", sub: "200–320 м²", min: 200, max: 320, A: 280, k: 1.35, depth: 12, h: 4.5, gap: 1.2,
      vars: { M: "clamp(round((A - 120) / 40), 3, 5)", B: "clamp(round(A / 80), 2, 4)", seats: "max(6, round(1.5 * M))", maket: "'3x2'" },
      about: "Полноценный офис: кабинеты менеджеров, переговорная и сделочная, зона макета, детский уголок, кухня и бэк-офис.",
      rows: [
        { key: "tambour", name: "Тамбур", zone: "public", cat: "circ", n: "1", w: 2.6, h: 2.5, border: "glass", rule: "глубина по ходу ≥ 2,45 м, двери наружу (СП 59)", sub: true },
        { key: "reception", name: "Ресепшен", zone: "public", cat: "client", n: "1", w: 4.4, h: 2.4, border: "none", sub: true, rule: "стойка 2,4–3 м, видна от входа" },
        { key: "wardrobe", name: "Гардероб посетителей", zone: "public", cat: "client", n: "1", w: 1.5, h: 3.2, status: "желательно", rule: "штанга 1,5 м или шкаф" },
        { key: "lounge", name: "Зона ожидания", zone: "public", cat: "client", n: "1", area: "seats * 1.8", border: "none", sub: true, rule: "max(6; 1,5·M) мест × 1,8 м²" },
        { key: "cafe", name: "Кофе-поинт", zone: "public", cat: "client", n: "1", w: 3, h: 3.2, border: "none", status: "желательно", color: "#D9B98E", rule: "стойка + 2 стола, мокрая точка" },
        { key: "maket", name: "Зона макета", zone: "public", cat: "client", n: "1", area: "maketArea", border: "none", sub: true, rule: "стол 3×2 + обход 1,2 м" },
        { key: "kids", name: "Детский уголок", zone: "public", cat: "client", n: "1", w: 3, h: 3, border: "none", sub: true, status: "желательно", color: "#F4D36B", rule: "виден из зоны ожидания" },
        { key: "cabinet", name: "Кабинет менеджера", zone: "semi", cat: "office", n: "M", w: 3, h: 3.2, border: "glass", color: "#9EA3A6", rule: "стекло в зал, 9,6 м²" },
        { key: "meet", name: "Переговорная на 6", zone: "semi", cat: "meet", n: "1", w: 4.5, h: 3.2, border: "glass", rule: "акустика Rw ≥ 42 дБ" },
        { key: "bank", name: "Ипотека / банк-партнёр", zone: "semi", cat: "office", n: "1", w: 3, h: 3.2, border: "glass", status: "опция" },
        { key: "vip", name: "Сделочная / VIP", zone: "private", cat: "meet", n: "1", area: "16", border: "glass", color: "#A8784E", rule: "подписание, 4–6 человек" },
        { key: "wcv", name: "С/у посетителей (МГН)", zone: "public", cat: "wc", n: "1", area: "5.5", color: "#CFE8E6", rule: "универсальная кабина ≥ 2,20×2,25" },
        { key: "wcs", name: "С/у персонала", zone: "service", cat: "wc", n: "1", w: 1.5, h: 2, color: "#CFE8E6" },
        { key: "kitchen", name: "Кухня / приём пищи", zone: "service", cat: "staff", n: "1", area: "max(9, M + B + 1)", rule: "1 м² на человека, не меньше 9 м²" },
        { key: "backoffice", name: "Бэк-офис", zone: "service", cat: "back", n: "1", area: "B * 4.5", rule: "4,5 м² на место с ПК" },
        { key: "director", name: "Кабинет руководителя", zone: "service", cat: "back", n: "1", w: 3, h: 3.5, status: "опция", color: "#A8784E" },
        { key: "kui", name: "КУИ", zone: "service", cat: "service", n: "1", w: 1.5, h: 1.5, rule: "кладовая уборочного инвентаря" },
        { key: "elec", name: "Электрощитовая", zone: "service", cat: "service", n: "1", w: 2, h: 1.5 },
        { key: "server", name: "Серверная / архив", zone: "service", cat: "service", n: "1", w: 1.5, h: 2 },
      ] },
    L: { name: "Флагман", sub: "350–600 м²", min: 350, max: 600, A: 500, k: 1.25, depth: 15, h: 7, gap: 1.2,
      vars: { M: "clamp(round((A - 200) / 45), 6, 10)", B: "clamp(round(A / 70), 5, 9)", seats: "max(10, round(1.5 * M))", maket: "A >= 560 ? '6x4' : '5x3'" },
      about: "Флагманский офис: бар, большой макет, медиа-зона, детская комната, шоурум материалов, две переговорные, кабинет РОП, бэк-офис (можно на антресоли).",
      rows: [
        { key: "tambour", name: "Тамбур", zone: "public", cat: "circ", n: "1", w: 2.6, h: 2.5, border: "glass", rule: "глубина по ходу ≥ 2,45 м, двери наружу", sub: true },
        { key: "reception", name: "Ресепшен / хостес", zone: "public", cat: "client", n: "1", w: 4.4, h: 2.4, border: "none", sub: true, rule: "стойка 3 м + зона встречи" },
        { key: "wardrobe", name: "Гардероб посетителей", zone: "public", cat: "client", n: "1", w: 2, h: 3.2 },
        { key: "lounge", name: "Лаунж / зона ожидания", zone: "public", cat: "client", n: "1", area: "seats * 1.8", border: "none", sub: true, rule: "max(10; 1,5·M) мест × 1,8 м²" },
        { key: "cafe", name: "Бар / кафе", zone: "public", cat: "client", n: "1", w: 5, h: 3.2, border: "none", color: "#D9B98E", rule: "барная стойка + столики, мокрая точка" },
        { key: "maket", name: "Зона макета", zone: "public", cat: "client", n: "1", area: "maketArea", border: "none", sub: true, rule: "стол 5×3 (6×4 от 560 м²) + обход 1,2 м" },
        { key: "media", name: "Медиа / VR зона", zone: "public", cat: "client", n: "1", w: 4, h: 3, border: "none", sub: true, status: "желательно" },
        { key: "kids", name: "Детская комната", zone: "public", cat: "client", n: "1", w: 4, h: 4, border: "none", sub: true, color: "#F4D36B", rule: "видна из лаунжа, не у входа и не у переговорных" },
        { key: "showroom", name: "Шоурум материалов (отделка, мокапы)", zone: "semi", cat: "client", n: "1", w: 7.5, h: 3.2, border: "glass", status: "желательно", rule: "образцы отделки, мокапы кухни и с/у 1:1" },
        { key: "cabinet", name: "Кабинет менеджера", zone: "semi", cat: "office", n: "M", w: 3, h: 3.2, border: "glass", color: "#9EA3A6", rule: "стекло в зал, 9,6 м²" },
        { key: "meet", name: "Переговорная на 6", zone: "semi", cat: "meet", n: "2", w: 4.5, h: 3.2, border: "glass", rule: "две: для подбора и для групп" },
        { key: "bank", name: "Ипотека / банк-партнёр", zone: "semi", cat: "office", n: "M > 8 ? 2 : 1", w: 3, h: 3.2, border: "glass", rule: "рядом со сделочной" },
        { key: "vip", name: "Сделочная / VIP", zone: "private", cat: "meet", n: "M > 8 ? 2 : 1", area: "22", border: "glass", color: "#A8784E", rule: "18–25 м²" },
        { key: "cashier", name: "Касса", zone: "private", cat: "service", n: "1", w: 3, h: 3, status: "опция", rule: "при эскроу обычно не нужна" },
        { key: "director", name: "Кабинет РОП", zone: "service", cat: "back", n: "1", w: 4, h: 4.5, color: "#A8784E", rule: "руководитель отдела продаж, 18 м²" },
        { key: "backoffice", name: "Бэк-офис open-space", zone: "service", cat: "back", n: "1", area: "B * 6", rule: "6 м² на место (≥ 4,5)" },
        { key: "kitchen", name: "Кухня / комната приёма пищи", zone: "service", cat: "staff", n: "1", area: "max(12, M + B + 3)", rule: "1 м² на человека в смене, ≥ 12 м²" },
        { key: "wcv", name: "С/у посетителей (М/Ж + МГН)", zone: "public", cat: "wc", n: "1", area: "12", color: "#CFE8E6", rule: "2 кабины + универсальная МГН" },
        { key: "wcs", name: "С/у персонала", zone: "service", cat: "wc", n: "ceil((M + B + 3) / 15)", w: 1.8, h: 2.5, color: "#CFE8E6" },
        { key: "kui", name: "КУИ", zone: "service", cat: "service", n: "1", w: 1.8, h: 2 },
        { key: "elec", name: "Электрощитовая", zone: "service", cat: "service", n: "1", w: 2, h: 2.5 },
        { key: "server", name: "Серверная", zone: "service", cat: "service", n: "1", w: 2, h: 2 },
        { key: "archive", name: "Архив", zone: "service", cat: "service", n: "1", w: 2.5, h: 2.5, rule: "запираемый (152-ФЗ)" },
        { key: "storage", name: "Склад POS-материалов", zone: "service", cat: "service", n: "1", w: 2, h: 2.5, status: "желательно" },
        { key: "security", name: "Пост охраны", zone: "service", cat: "service", n: "1", w: 2, h: 1.8, status: "опция" },
      ] },
  };
  KB.DEFAULT_PACKAGES = JSON.parse(JSON.stringify(KB.PACKAGES));
  KB.STATUSES = ["обязательно", "желательно", "опция"];

  // Безопасный калькулятор формул: только числа, переменные, + - * / ( ) ? : < > = ! & | , ' и функции min/max/round/ceil/floor/clamp
  KB.evalExpr = function (expr, vars) {
    if (typeof expr === "number") return expr;
    const src = String(expr == null ? "" : expr).trim().replace(/,(?=\d)/g, ".");
    if (!src) return 0;
    if (!/^[\w\s.+\-*/()?:<>=!&|,'"]*$/.test(src)) throw new Error("Недопустимые символы в формуле: " + src);
    const allowed = new Set(["min", "max", "round", "ceil", "floor", "clamp", ...Object.keys(vars)]);
    const ids = src.replace(/'[^']*'|"[^"]*"/g, "").match(/[A-Za-z_]\w*/g) || [];
    for (const id of ids) if (!allowed.has(id)) throw new Error(`Неизвестное имя «${id}» в формуле: ${src}`);
    const fn = new Function("min", "max", "round", "ceil", "floor", "clamp", ...Object.keys(vars), "return (" + src + ");");
    return fn(Math.min, Math.max, Math.round, Math.ceil, Math.floor, (x, a, b) => Math.min(b, Math.max(a, x)), ...Object.values(vars));
  };

  // Программа из пакета: rows с вычисленными n и area; opts[key] включает/выключает строки; counts[key] — ручное количество
  KB.packageProgram = function (pkgKey, A, opts = {}, counts = {}, pkgDef) {
    const P = pkgDef || KB.PACKAGES[pkgKey]; if (!P) throw new Error("Нет пакета " + pkgKey);
    const v = { A: +A || P.A };
    v.M = Math.max(1, Math.round(KB.evalExpr(P.vars.M, v)));
    if (counts.cabinet != null) v.M = Math.max(1, +counts.cabinet);
    v.B = Math.max(0, Math.round(KB.evalExpr(P.vars.B, v)));
    v.seats = Math.max(1, Math.round(KB.evalExpr(P.vars.seats, v)));
    const maket = String(KB.evalExpr(P.vars.maket || "'3x2'", v)); const mk = KB.MAKET[maket] || KB.MAKET["3x2"];
    v.maketArea = +((mk[0] + 2 * (P.gap || 1.2)) * (mk[1] + 2 * (P.gap || 1.2))).toFixed(2);
    const rows = [];
    for (const r of P.rows) {
      const on = r.status === "опция" ? !!opts[r.key] : (r.status === "желательно" ? opts[r.key] !== false : true);
      if (!on) continue;
      let n = counts[r.key] != null ? +counts[r.key] : Math.round(KB.evalExpr(r.n ?? "1", v));
      if (!(n > 0)) continue;
      let w = +r.w || 0, h = +r.h || 0, area = r.area != null ? +KB.evalExpr(r.area, v) : w * h;
      if (r.key === "maket") { w = +(mk[0] + 2 * (P.gap || 1.2)).toFixed(2); h = +(mk[1] + 2 * (P.gap || 1.2)).toFixed(2); area = w * h; }
      const row = { key: r.key, name: r.name, zone: r.zone, cat: r.cat, n, w, h, area: +area.toFixed(2), border: r.border || "wall", status: r.status || "обязательно", rule: r.rule || "", sub: !!r.sub };
      if (r.color) row.color = r.color;
      if (r.key === "lounge") row.seats = v.seats;
      rows.push(row);
    }
    const net = rows.reduce((s, r) => s + r.n * r.area, 0);
    return { rows, vars: v, maket, net: +net.toFixed(1), need: +(net * (P.k || 1.3)).toFixed(0), k: P.k || 1.3 };
  };

  // Здание под площадь пакета: глубина из пакета, длина из площади (внутри стен 0,3 м)
  KB.suggestBuilding = function (pkgKey, A, pkgDef) {
    const P = pkgDef || KB.PACKAGES[pkgKey]; const d = P.depth || 12, w = +(((+A || P.A) / (d - 0.6)) + 0.6).toFixed(1);
    return { w, d, h: P.h || 4.5 };
  };

  /* ------------------------------------------------------------ программа помещений */
  KB.program = function (p0) {
    if (p0 && p0.pkg) {
      const pp = KB.packageProgram(p0.pkg, p0.area, p0.opts || {}, p0.counts || {}, p0.pkgDef);
      const P = p0.pkgDef || KB.PACKAGES[p0.pkg], v = pp.vars, has = k => pp.rows.some(r => r.key === k);
      const p = Object.assign({}, KB.DEFAULTS, p0, { M: v.M, B: v.B, maket: pp.maket, compact: !!P.compact, gap: P.gap || 1.2, k: P.k,
        kids: has("kids"), cafe: has("cafe"), wardrobe: has("wardrobe"), bank: has("bank"), cashier: has("cashier"), media: has("media"), showroom: has("showroom"), director: has("director") });
      return { params: p, rows: pp.rows, seats: v.seats, staff: v.M + v.B + 1 };
    }
    const p = Object.assign({}, KB.DEFAULTS, p0);
    const M = Math.max(1, Math.round(p.M)), B = Math.max(0, Math.round(p.B));
    const mk = KB.MAKET[p.maket] || KB.MAKET["5x3"];
    const seats = Math.max(6, Math.ceil(1.5 * M));
    const staff = M + B + (p.director ? 1 : 0) + 1; // + хостес
    const R = [];
    const add = (key, name, zone, cat, n, w, h, o = {}) =>
      R.push(Object.assign({ key, name, zone, cat, n, w, h, area: +(w * h).toFixed(2), border: "wall", status: "обязательно", rule: "" }, o));
    add("tambour", "Тамбур", "public", "circ", 1, 2.6, 2.5, { border: "glass", rule: "глубина по ходу ≥ 2,45 м, двери наружу (СП 59)" });
    add("reception", "Ресепшен", "public", "client", 1, 4.4, 2.4, { border: "none", sub: true, rule: "стойка 3 м, видна от входа" });
    add("lounge", "Зона ожидания", "public", "client", 1, 0, 0, { area: +(seats * 1.8).toFixed(1), border: "none", sub: true, seats, rule: `мест max(6; 1,5·M) = ${seats} × 1,8 м²` });
    add("maket", "Зона макета", "public", "client", 1, +(mk[0] + 2.4).toFixed(2), +(mk[1] + 2.4).toFixed(2), { border: "none", sub: true, rule: `стол ${mk[0]}×${mk[1]} + обход 1,2 м` });
    if (p.kids) add("kids", "Детская зона", "public", "client", 1, 3.5, 3.5, { border: "none", sub: true, status: "желательно", color: "#F4D36B", rule: "видна из зоны ожидания, не у входа" });
    if (p.cafe) add("cafe", "Кофе-поинт", "public", "client", 1, 4, 3.2, { border: "none", status: "желательно", color: "#D9B98E", rule: "мокрая точка" });
    if (p.wardrobe) add("wardrobe", "Гардероб посетителей", "public", "client", 1, 2, 3.2, { border: "wall", status: "желательно" });
    if (p.media) add("media", "Медиа / VR зона", "public", "client", 1, 4, 3, { border: "none", sub: true, status: "опция" });
    add("cabinet", "Кабинет менеджера", "semi", "office", M, 3, 3.2, { border: "glass", color: "#9EA3A6", rule: "1 на менеджера, стекло в зал" });
    add("meet", "Переговорная на 6", "semi", "meet", Math.max(1, Math.round(M * 0.2)), 4.5, 3.2, { border: "glass", rule: "max(1; 0,2·M), акустика Rw ≥ 42 дБ" });
    if (p.bank) add("bank", "Ипотека / банк-партнёр", "semi", "office", M > 12 ? 2 : 1, 3, 3.2, { border: "glass" });
    if (p.showroom) add("showroom", "Шоурум отделки", "semi", "client", 1, 5, 3.2, { border: "glass", status: "опция" });
    add("vip", "Сделочная / VIP", "private", "meet", Math.ceil(M / 6), 0, 0, { area: 22, border: "glass", color: "#A8784E", rule: "ceil(M/6), 18–25 м²" });
    if (p.cashier) add("cashier", "Касса", "private", "service", 1, 3, 3, { status: "опция", rule: "усиленная дверь, сейф; при эскроу обычно не нужна" });
    add("wcv", "С/у посетителей", "public", "wc", 1, 0, 0, { area: M >= 6 ? 8.8 : 5, color: "#CFE8E6", rule: "универсальная кабина МГН ≥ 2,20×2,25 (СП 59 табл. 6.1)" });
    add("backoffice", "Бэк-офис open-space", "service", "back", 1, 0, 0, { area: Math.max(12, B * 6), rule: `B × 6 м² (≥ 4,5 м² на место с ПК)` });
    if (p.director) add("director", "Кабинет руководителя", "service", "back", 1, 4, 4.5, { status: "желательно", color: "#A8784E", rule: "18 м² (СП 118 п. 5.31, рекомендация)" });
    add("kitchen", "Кухня / приём пищи", "service", "staff", 1, 0, 0, { area: Math.max(12, staff), rule: `1 м² на человека в смене, ≥ 12 м² (${staff} чел.)` });
    add("wcs", "С/у персонала", "service", "wc", Math.max(1, Math.ceil(staff / 15)), 1.8, 2.5, { color: "#CFE8E6" });
    add("kui", "КУИ", "service", "service", 1, 1.8, 2, { rule: "кладовая уборочного инвентаря, с водой" });
    add("elec", "Электрощитовая", "service", "service", 1, 2, 2.5, { rule: "не под мокрыми помещениями" });
    add("server", "Серверная / архив", "service", "service", 1, 2, 2.5);
    return { params: p, rows: R, seats, staff };
  };

  // Вмещается ли программа: Σ целей × k (коммуникации) против площади внутри наружных стен
  KB.fit = function (p0) {
    const pr = KB.program(p0), p = pr.params;
    const need = pr.rows.reduce((s, r) => s + r.n * r.area, 0), k = p.k || 1.35;
    const mezzOk = p.mezz === "yes" || (p.mezz === "auto" && p.h >= 6.2);
    const inner = (p.w - 0.6) * (p.d - 0.6), have = inner + (mezzOk && p.h - 3.3 >= 2.2 ? Math.min(0.38 * inner, 290) : 0);
    return { need: +(need * k).toFixed(0), net: +need.toFixed(0), have: +have.toFixed(0), k, ratio: +(have / (need * k)).toFixed(2), mezz: mezzOk };
  };

  /* ------------------------------------------------------------ утилиты модели планировщика */
  let _n = 0;
  const uid = () => "g" + (++_n).toString(36) + Math.random().toString(36).slice(2, 7);
  const r3 = v => Math.round(v * 1000) / 1000;
  function room(name, x, y, w, h, cat, border, o = {}) {
    return Object.assign({ id: uid(), t: "room", lv: 0, name, x: r3(x), y: r3(y), w: r3(w), h: r3(h), cat, border, color: KB.CAT[cat].c, sub: false, ph: 3 }, o);
  }
  function furn(k, x, y, rot = 0, o = {}) {
    const d = DIMS[k] || (KB.FK[k] ? [KB.FK[k].w, KB.FK[k].h] : [1, 1]);
    return Object.assign({ id: uid(), t: "item", lv: 0, k, x: r3(x), y: r3(y), w: d[0], h: d[1], rot, flip: false, label: "" }, o);
  }
  // Дверь на стороне помещения: side n|s|e|w, off — от левого/верхнего угла, inward — открывается внутрь
  function door(r, side, off, w = 0.9, inward = true, o = {}) {
    const k = w >= 1.6 ? "door18" : "door9", h = k === "door18" ? w / 2 + 0.3 : w + 0.3, t = 0.15;
    let x, y, rot;
    if (side === "s") { const ey = r.y + r.h; rot = inward ? 180 : 0; x = r.x + off; y = inward ? ey + t - h : ey - t; }
    if (side === "n") { const ey = r.y; rot = inward ? 0 : 180; x = r.x + off; y = inward ? ey - t : ey + t - h; }
    if (side === "w") { const ex = r.x; rot = inward ? 270 : 90; y = r.y + off; x = inward ? ex - t : ex + t - h; }
    if (side === "e") { const ex = r.x + r.w; rot = inward ? 90 : 270; y = r.y + off; x = inward ? ex + t - h : ex - t; }
    return Object.assign({ id: uid(), t: "item", lv: r.lv || 0, k, x: r3(x), y: r3(y), w, h: r3(h), rot, flip: false, label: "" }, o);
  }
  const center = (r, w, h) => [r.x + (r.w - w) / 2, r.y + (r.h - h) / 2];

  /* ------------------------------------------------------------ генератор планировки */
  KB.generate = function (p0) {
    const prog = KB.program(p0), p = prog.params, rows = prog.rows, warn = [];
    const W = +p.w, D = +p.d, H = +p.h, t = 0.3;
    const x0 = t, x1 = W - t, y0 = t, y1 = D - t, Din = y1 - y0, Lin = x1 - x0;
    const get = k => rows.find(r => r.key === k);
    let mezz = p.mezz === "yes" || (p.mezz === "auto" && H >= 6.2);
    const mz = 3.3;
    if (mezz && H - mz < 2.2) { warn.push(`Антресоль не помещается по высоте: над ней остаётся ${(H - mz).toFixed(2)} м < 2,2 м. Антресоль отключена.`); mezz = false; }
    const I = [], unplaced = [];
    const sum = a => a.reduce((s, r) => s + r.w, 0);
    // Схема: задний ряд (глубина 3,2) вдоль глухой стены — сквозной: [кофе, гардероб, кабинеты, переговорные …] … [лестница, с/у, КУИ, щитовая].
    // Проход 1,8 вдоль ряда — главная коммуникация. Передний ряд у витража в правом торце — сервисный блок: VIP, кухня, (бэк-офис).
    // Остальная полоса у витража — публичная: детская, ожидание, макет, вход с ресепшен.
    const cabR = get("cabinet"), openDesks = !!(cabR && cabR.border === "none"), gap = p.gap || 1.2;
    const baseRow = cabR && !openDesks ? cabR.h : (p.compact ? 2.6 : 3.2);
    const shallow = D < 11, rowD = shallow ? Math.min(3.0, baseRow) : baseRow, aisle = shallow ? 1.5 : 1.8, yA = y0 + rowD + aisle, df = y1 - yA;
    const deep = df >= 8.6; // глубокий зал: второй ряд кабинетов и две полосы у витража
    const dfS = df > 7.4 ? 6.2 : df; // глубина сервисного блока; при глубоком здании зал продолжается вдоль витража
    if (df < (p.compact ? 3.6 : 4.5)) warn.push(`Глубина здания мала для схемы с проходом: у витража остаётся ${df.toFixed(1)} м.`);
    const mk0 = (k, w, extra = {}) => { const pr = get(k); w = pr.w || w; return Object.assign({ key: k, name: pr.name, cat: pr.cat, border: pr.border, color: pr.color, w, w0: w }, extra); };
    const KNOWN = new Set(["tambour", "reception", "lounge", "maket", "kids", "cafe", "wardrobe", "media", "cabinet", "meet", "bank", "showroom", "vip", "cashier", "wcv", "wcs", "backoffice", "director", "kitchen", "kui", "elec", "server"]);
    // задний ряд: клиентская часть
    let hallRow = [];
    if (get("cafe")) hallRow.push(mk0("cafe", 4));
    if (get("wardrobe")) hallRow.push(mk0("wardrobe", 2));
    if (cabR) for (let i = 0; i < cabR.n; i++) hallRow.push(mk0("cabinet", 3));
    if (get("meet")) for (let i = 0; i < get("meet").n; i++) hallRow.push(mk0("meet", 4.5));
    for (const r of rows) if (!KNOWN.has(r.key) && (r.zone === "semi" || r.zone === "private") && !r.sub) for (let i = 0; i < r.n; i++) hallRow.push({ key: r.key, name: r.name, cat: r.cat, border: r.border, color: r.color, w: r.w || Math.max(2.4, r.area / rowD), w0: r.w || 3 });
    if (get("bank")) for (let i = 0; i < get("bank").n; i++) hallRow.push(mk0("bank", 3));
    if (get("showroom")) hallRow.push(mk0("showroom", 5));
    // задний ряд: служебная часть в правом торце; лестница — у торца, чтобы антресоль была компактной
    const wcv = get("wcv"), wcs = get("wcs");
    const svcRow = [];
    const pw = (r, def) => p.pkg ? Math.max(r.w && r.h ? r.w * r.h / rowD : 0, r.w || 0, Math.min(def, 1.0)) : def;
    if (wcv) svcRow.push({ key: "wcv", name: wcv.name, cat: "wc", border: "wall", w: p.pkg ? Math.max(2.4, wcv.area / rowD) : (p.M >= 6 ? 3.9 : 2.4), color: wcv.color });
    if (wcs) for (let i = 0; i < wcs.n; i++) svcRow.push({ key: "wcs", name: wcs.name, cat: "wc", border: "wall", w: p.pkg ? Math.max(1.5, wcs.w * wcs.h / rowD) : 1.8, color: wcs.color });
    const kuiR = get("kui"), elecR = get("elec"), servR = get("server");
    if (kuiR) svcRow.push({ key: "kui", name: kuiR.name, cat: "service", border: "wall", w: p.pkg ? Math.max(1.0, kuiR.area / rowD) : 1.8 });
    if (elecR) svcRow.push({ key: "elec", name: elecR.name, cat: "service", border: "wall", w: p.pkg ? Math.max(1.2, elecR.area / rowD) : 2.0 });
    if (!mezz && servR) svcRow.push({ key: "server", name: servR.name, cat: "service", border: "wall", w: p.pkg ? Math.max(1.5, servR.area / rowD) : 2.0 });
    for (const r of rows) if (!KNOWN.has(r.key) && r.zone === "service" && !r.sub) for (let i = 0; i < r.n; i++) svcRow.push({ key: r.key, name: r.name, cat: r.cat, border: r.border, color: r.color, w: Math.max(1.5, r.area / rowD) });
    if (mezz) svcRow.push({ key: "stair", name: "Лестничная клетка", cat: "circ", border: "none", w: 2.8 });
    // передний ряд у витража в правом торце
    const vip = get("vip"), kit = get("kitchen"), bo = get("backoffice"), dir = get("director"), cash = get("cashier");
    const front = [];
    if (vip) for (let i = 0; i < vip.n; i++) front.push({ key: "vip", name: vip.name, cat: "meet", border: "glass", w: Math.max(p.pkg ? 3.0 : 4.2, vip.area / dfS), color: vip.color });
    if (cash) front.push({ key: "cashier", name: "Касса", cat: "service", border: "wall", w: Math.max(2.4, 9 / dfS) });
    if (p.compact) {   // маленький офис: всё служебное — в задний ряд, у витража только сделочная
      if (kit) svcRow.splice(1, 0, { key: "kitchen", name: kit.name, cat: "staff", border: "wall", w: Math.max(2.0, kit.area / rowD) });
      if (bo) svcRow.splice(2, 0, { key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Math.max(2.0, bo.area / rowD) });
      if (dir) svcRow.splice(2, 0, { key: "director", name: dir.name, cat: "back", border: "wall", w: Math.max(3.0, dir.area / rowD), color: dir.color });
    } else {
      if (kit) front.push({ key: "kitchen", name: kit.name, cat: "staff", border: "wall", w: Math.max(2.6, kit.area / dfS) });
      if (!mezz) {
        if (dir) front.push({ key: "director", name: dir.name, cat: "back", border: "wall", w: Math.max(3.2, (dir.area || 18) / dfS), color: dir.color });
        if (bo) front.push({ key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Math.max(3, bo.area / dfS) });
      }
    }
    const mkS = KB.MAKET[p.maket] || KB.MAKET["5x3"];
    const needPublic = (get("kids") ? 4.0 : 0) + (get("cafe") ? 4.4 : 0) + mkS[0] + 2 * gap + 1.2 + 4.8 + Math.min(Math.ceil((get("lounge") ? get("lounge").seats : 6) / 5), 2) * 2.8;
    const pubMin = Math.max(needPublic, 0.45 * Lin);
    const canRow2 = df >= 7.8;
    // переполнение заднего ряда: кабинеты — во второй ряд (остров), переговорные и ипотека — к VIP или во второй ряд,
    // кофе-поинт — в публичную зону, остальное — «не размещено»
    const row2 = []; let cafePublic = false, deskHall = 0;
    const over = () => sum(hallRow) + sum(svcRow) - Lin;
    const takeLast = k => { const i = hallRow.map(r => r.key).lastIndexOf(k); return i < 0 ? null : hallRow.splice(i, 1)[0]; };
    for (const k of ["cafe", "wardrobe", "bank", "showroom", "meet", "cabinet"]) {
      while (over() > 1e-6) {
        const it = takeLast(k); if (!it) break;
        if (k === "cafe") { cafePublic = true; continue; }
        if (k === "cabinet" && openDesks) { deskHall++; continue; }
        const fw = Math.max(k === "bank" ? 2.6 : 3.4, (it.w * rowD) / dfS);
        if ((k === "bank" || k === "meet") && (dfS < df || (x1 - sum(front) - fw) - x0 >= pubMin)) { it.w = fw; front.splice(vip.n, 0, it); continue; }
        if (canRow2) { row2.push(it); continue; }
        unplaced.push(it.name);
      }
    }
    // освободившееся место в заднем ряду — обратно помещениям (сначала «не размещённые», потом перенесённые к витражу)
    { const back = [...unplaced.map(n => ({ n })), ...front.filter(f => f.w0).map(f => ({ f }))];
      for (const c of back) { const gap = Lin - sum(hallRow) - sum(svcRow);
        const key = c.f ? c.f.key : rows.find(r => r.name === c.n)?.key; if (!key) continue;
        const w0 = { cabinet: 3, meet: 4.5, bank: 3, showroom: 5, wardrobe: 2, cafe: 4 }[key]; if (!w0 || w0 > gap + 1e-6) continue;
        if (c.f) front.splice(front.indexOf(c.f), 1); else unplaced.splice(unplaced.indexOf(c.n), 1);
        const it = mk0(key, w0); const at = hallRow.map(r => r.key).lastIndexOf(key); hallRow.splice(at < 0 ? hallRow.length : at + 1, 0, it); } }
    const Lf = sum(front), xs = x1 - Lf;             // левая граница сервисного блока у витража
    const xP = dfS < df ? x1 : x1 - sum(front);        // правая граница публичной полосы у витража
    // ---- упаковка публичной полосы у витража: [детская] [ожидание…] [макет] [вход + ресепшен] [ожидание…] [кофе]
    const yP0 = row2.length ? yA + rowD : yA, bandD = y1 - yP0;
    const kidR0 = get("kids"), cafR = get("cafe"), tamR = get("tambour"), recR = get("reception");
    let kw = kidR0 ? Math.max(2, kidR0.w || 3.5) : 0, kh = kidR0 ? Math.max(2, kidR0.h || 3.5) : 0;
    const cw = cafR ? Math.max(2.4, Math.min(4.4, cafR.w || 4)) : 0, ch = cafR ? Math.min(3.5, Math.max(2, cafR.h || 3.5)) : 0;
    const tw = tamR ? Math.max(2.2, tamR.w || 2.6) : 0, th = tamR ? Math.max(2.2, tamR.h || 2.5) : 0;
    const rw = recR ? (recR.w || 4.4) : 0, rh = recR ? (recR.h || 2.4) : 0;
    const beside = !!recR && (p.compact || bandD < th + 1.2 + rh + 0.2);   // ресепшен рядом со входом, если глубины мало
    const eW = beside ? Math.max(tw, 1.4) + 0.3 + rw : Math.max(tw, rw, 3);
    const small = p.compact ? KB.MAKET["2x1.5"] : KB.MAKET["3x2"];
    let mk = mkS, mw = mk[0] + 2 * gap, mh = mk[1] + 2 * gap, useKids = !!kidR0, useCafe = !!(cafR && cafePublic), useMaket = !!get("maket");
    const lounge = get("lounge") || { seats: 0 }, per = p.compact ? 3 : 5, groups = Math.ceil(lounge.seats / per), gw = 2.2, gh = p.compact ? 1.8 : 2.9;
    const innerOK = () => bandD >= (p.compact ? gh + 0.6 : 3.5) + 1.0 + mh + 0.3;
    if (useMaket && !innerOK() && mh + 0.6 > bandD) { if (mk !== small) { mk = small; mw = mk[0] + 2 * gap; mh = mk[1] + 2 * gap; warn.push(`Стол макета уменьшен до ${mk[0]}×${mk[1]}: не хватает глубины зала.`); } if (mh + 0.6 > bandD) { useMaket = false; warn.push("Зона макета не помещается по глубине зала — поставьте экран или уменьшите макет."); } }
    let inner = useMaket && innerOK();
    const L = xP - x0 - 0.6, G = 0.6;
    const minL = groups > 0 ? gw + G : 0;   // хотя бы одна мягкая зона у витража
    const seqW = () => minL + (useKids ? kw + G : 0) + (useMaket && !inner ? mw + G : 0) + eW + (useCafe ? cw + G : 0);
    if (seqW() > L && useCafe) { useCafe = false; unplaced.push(cafR.name); }
    if (seqW() > L && useKids) { useKids = false; unplaced.push(kidR0.name); }
    if (seqW() > L && useMaket && !inner && mk !== small) { mk = small; mw = mk[0] + 2 * gap; mh = mk[1] + 2 * gap; inner = innerOK(); warn.push(`Стол макета уменьшен до ${mk[0]}×${mk[1]}: не хватает длины витрины.`); }
    if (seqW() > L && useMaket && !inner) { useMaket = false; warn.push("Зона макета не помещается вдоль витрины — поставьте экран или увеличьте длину здания."); }
    let freeW = L - seqW() + minL; const nL = Math.max(0, Math.min(groups, Math.floor(freeW / (gw + G))));
    freeW -= nL * (gw + G);
    const seq = [];
    if (useKids) seq.push({ t: "kids", w: kw });
    for (let i = 0; i < Math.ceil(nL / 2); i++) seq.push({ t: "lounge", w: gw });
    if (useMaket && !inner) seq.push({ t: "maket", w: mw });
    seq.push({ t: "ent", w: eW });
    for (let i = 0; i < Math.floor(nL / 2); i++) seq.push({ t: "lounge", w: gw });
    if (useCafe) seq.push({ t: "cafe", w: cw });
    const extra = seq.length > 1 ? freeW / (seq.length - 1) : 0;
    { let x = x0 + 0.3 + (seq.length > 1 ? 0 : freeW / 2); for (const it of seq) { it.x = x; x += it.w + G + extra; } }
    const ent = seq.find(it => it.t === "ent");
    let cE = beside ? ent.x + Math.max(tw, 1.4) / 2 : ent.x + eW / 2;
    { // дверь не должна попасть на колонну витража (шаг 5 м): сдвиг блока входа в пределах соседних зазоров
      const i = seq.indexOf(ent), lo = i > 0 ? seq[i - 1].x + seq[i - 1].w + 0.3 : x0 + 0.3, hi = i < seq.length - 1 ? seq[i + 1].x - 0.3 : xP - 0.3;
      const dw = tw && tw < 2.6 ? 1.2 : 1.8, ok = c => { for (let k = 0; k * 5 <= W; k++) if (Math.abs(c - k * 5) < dw / 2 + 0.25) return false; return true; };
      for (let d = 0; d <= 2.5; d += 0.05) { let hit = false; for (const s of [d, -d]) { const nx = ent.x + s, nc = cE + s; if (nx >= lo - 1e-6 && nx + eW <= hi + 1e-6 && ok(nc)) { ent.x = nx; cE = nc; hit = true; break; } } if (hit) break; } }
    // второй ряд — два острова по сторонам от оси входа, проход 2,4 м к ресепшен
    const segs = [[x0 + 0.6, Math.min(cE - 2.6, xs - 0.6)], [cE + 2.6, xs - 0.6]].filter(g => g[1] - g[0] >= 2.6), R2items = [];
    { let si = 0, cx = segs.length ? segs[0][0] : 0;
      for (const it of row2) { while (si < segs.length && cx + it.w > segs[si][1] + 1e-6) { si++; if (si < segs.length) cx = segs[si][0]; }
        if (si >= segs.length) { unplaced.push(it.name); continue; } R2items.push([it, cx]); cx += it.w; } }
    if (unplaced.length) warn.push(`Не поместились: ${unplaced.join(", ")}. Увеличьте длину здания или уменьшите программу.`);
    const place = (row, x, y, h, lv = 0) => row.map(it => { const r = room(it.name, x, y, it.w, h, it.cat, it.border, { lv, color: it.color || KB.CAT[it.cat].c }); r._key = it.key; x += it.w; I.push(r); return r; });
    const HR = place(hallRow, x0, y0, rowD);
    const svcX = x1 - sum(svcRow);
    const SR = place(svcRow, svcX, y0, rowD);
    const FR = place(front, xs, yA, dfS);
    if (dfS < df) I.push(room("Зал продаж (у витража)", xs, yA + dfS, x1 - xs, df - dfS, "client", "none", { color: "#EDE8DE" }));
    const R2 = R2items.map(([it, cx]) => place([it], cx, yA, rowD)[0]);
    const yP = R2.length ? yA + rowD : yA;            // начало публичной зоны
    for (const r of R2) { const k = r._key;
      if (k === "cabinet" || k === "bank") { I.push(furn("work3", r.x + r.w / 2 - 0.8, r.y + 0.5, 180)); I.push(furn("slide", r.x + 0.3, r.y - 0.15)); }
      else if (k === "meet") { I.push(furn("meet6", r.x + (r.w - 2.4) / 2, r.y + 0.75)); I.push(door(r, "n", 0.3, 0.9, true)); }
      else I.push(door(r, "n", 0.3, 0.9, true)); }
    const hall = room("Зал продаж", x0, yA, xs - x0, df, "client", "none", { color: "#EDE8DE" });
    I.unshift(hall);
    const endHall = HR.length ? HR[HR.length - 1].x + HR[HR.length - 1].w : x0;
    if (svcX - endHall > 0.3) I.push(room("Проход", endHall, y0, svcX - endHall, rowD, "circ", "none", { color: "#EDE8DE" }));
    I.push(room("Проход вдоль кабинетов", x0, y0 + rowD, xs - x0, aisle, "circ", "none", { color: "#EDE8DE" }));
    I.push(room("Коридор", xs, y0 + rowD, Lf, aisle, "circ", "none"));

    // наполнение заднего ряда
    for (const r of HR) { const k = r._key, x = r.x, w = r.w;
      if (k === "cabinet" && openDesks) { r.sub = false; I.push(furn("work3", x + w / 2 - 0.8, y0 + Math.max(0.1, (rowD - 2.3) / 2))); }
      else if (k === "cabinet" || k === "bank") { I.push(furn("work3", x + w / 2 - 0.8, y0 + 0.4)); I.push(furn("slide", x + 0.3, y0 + rowD - 0.15)); }
      if (k === "meet") { I.push(furn("meet6", x + (w - 2.4) / 2, y0 + 0.35)); I.push(door(r, "s", 0.3, 0.9, true)); }
      if (k === "showroom") { I.push(furn("stand", x + 0.4, y0 + 0.2, 0, { w: w - 0.8 })); I.push(door(r, "s", 0.3, 0.9, true)); }
      if (k === "wardrobe") { I.push(furn("shelf", x + 0.1, y0 + 0.2, 90, { w: 2.6 })); }
      if (k === "cafe") { I.push(furn("kitch", x, y0, 0, { w: 4 })); I.push(furn("bar", x + 0.5, y0 + 1.5, 0, { w: 3.5 })); for (let i = 0; i < 4; i++) I.push(furn("stool", x + 0.9 + i * 0.8, y0 + 2.3)); }
    }
    for (const r of SR) { const k = r._key;
      if (k === "stair") { I.push(furn("stair2", r.x + 0.1, r.y, 0, { h: Math.min(4, rowD + aisle - 0.2) })); continue; }
      I.push(door(r, "s", 0.2, k === "wcv" ? 1.0 : 0.8, false));
      if (k === "wcv") { I.push(furn("wc", r.x + 1.0, r.y + 0.1)); I.push(furn("sink", r.x + 1.7, r.y + 1.4, 90)); if (r.w >= 3.5) { I.push(furn("cubicle", r.x + r.w - 1.35, r.y + 0.05)); I.push(furn("wc", r.x + r.w - 0.95, r.y + 0.1)); } }
      if (k === "wcs") { I.push(furn("wc", r.x + 0.7, r.y + 0.1)); I.push(furn("sink", r.x + r.w - 0.6, r.y + 1.3, 90)); }
      if (k === "kui" || k === "server") I.push(furn("shelf", r.x + 0.1, r.y + 0.1, 0, { w: Math.min(1.6, r.w - 0.2) }));
    }
    for (const r of FR) { const k = r._key;
      if (k === "vip" || k === "meet" || k === "bank" || k === "showroom") {
        if (r === FR[0]) I.push(door(r, "w", 0.4, 0.9, true)); else I.push(door(r, "n", 0.3, 0.9, true));
        if (k === "vip" || k === "meet") { const t8 = k === "vip" && r.w >= 4.0 ? "meet8" : "meet6"; const [cx, cy] = center(r, DIMS[t8][0], DIMS[t8][1]); I.push(furn(t8, cx, cy)); }
        if (k === "bank") I.push(furn("work3", r.x + r.w / 2 - 0.8, r.y + 1.0, 180));
        continue; }
      I.push(door(r, "n", 0.3, k === "cashier" ? 1.0 : 0.9, true));
      if (k === "kitchen") { I.push(furn("kitch", r.x + r.w - 0.6, r.y + 1.1, 90, { w: Math.min(2.4, r.h - 1.5) })); if (r.w >= 3.2) I.push(furn("dine", r.x + 0.3, r.y + r.h - 2.3)); else I.push(furn("desk", r.x + 0.2, r.y + r.h - 1.0, 0, { w: Math.min(1.6, r.w - 0.8), label: "стол" })); I.push(furn("fridge", r.x + r.w - 0.75, r.y + r.h - 0.8)); }
      if (k === "cashier") { I.push(furn("desk", r.x + 0.2, r.y + r.h - 1.0, 0, { w: Math.min(1.6, r.w - 0.4) })); I.push(furn("safe", r.x + r.w - 0.6, r.y + r.h - 0.6)); }
      if (k === "director") { const [cx, cy] = center(r, 1.8, 0.9); I.push(furn("deskB", cx, cy)); I.push(furn("chairO", cx + 0.6, cy + 1.0, 180)); I.push(furn("chairV", cx + 0.3, cy - 0.7)); I.push(furn("chairV", cx + 1.0, cy - 0.7)); }
      if (k === "backoffice") fillOpen(r);
    }
    function fillOpen(r) {
      let need = Math.max(1, Math.ceil(p.B / 4)), placed = 0;
      for (let y = r.y + 0.6; y + 2.6 <= r.y + r.h - 0.3 && placed < need; y += 3.6)
        for (let x = r.x + 0.5; x + 2.8 <= r.x + r.w - 0.3 && placed < need; x += 3.8) { I.push(furn("os4", x, y, 0, { lv: r.lv })); placed++; }
      let seats = placed * 4;
      for (let y = r.y + 0.4; y + 1.3 <= r.y + r.h - 0.2 && seats < p.B; y += 1.9)
        for (let x = r.x + 0.3; x + 1.4 <= r.x + r.w - 0.2 && seats < p.B; x += 1.6) { if (placed && y < r.y + 0.6 + Math.ceil(placed / Math.max(1, Math.floor((r.w - 0.8) / 3.8))) * 3.6) continue; I.push(furn("os1", x, y, 0, { lv: r.lv })); seats++; }
      if (seats < p.B) warn.push(`В бэк-офисе помещается ${seats} мест из ${p.B}.`);
    }
    I.push(door({ x: x1 - 0.001, y: y0 + rowD, w: 0.001, h: aisle, lv: 0 }, "e", 0.35, 1.1, false, { label: "Служебный вход" }));

    // публичная полоса у витража (позиции из упаковки выше)
    const dW = tw && tw < 2.6 ? 1.2 : 1.8;
    if (tamR) { I.push(room(tamR.name, cE - tw / 2, y1 - th, tw, th, "circ", "glass", { sub: true }));
      I.push(door({ x: cE - dW / 2, y: y1 - th, w: dW, h: 0.001 }, "n", 0, dW, true)); }
    I.push(door({ x: cE - dW / 2, y: y1, w: dW, h: 0.001 }, "n", 0, dW, true));
    const recX = beside ? ent.x + Math.max(tw, 1.4) + 0.3 : cE - rw / 2;
    const recY = beside ? y1 - rh - 0.4 : Math.max(yP + 0.2, y1 - th - 1.5 - rh);
    if (recR) {
      if (!beside && y1 - th - (recY + rh) < 1.2) warn.push("Мало места между тамбуром и ресепшен (зона «декомпрессии» < 1,2 м).");
      I.push(room(recR.name, recX, recY, rw, rh, "client", "none", { sub: true }));
      if (beside) { I.push(furn("recep", recX + 0.2, recY + 0.2, 90, { w: Math.min(1.4, rh - 0.3) })); I.push(furn("chairO", recX + 1.2, recY + 0.4)); }
      else { const dk = Math.min(3, rw - 0.8); I.push(furn("recep", cE - dk / 2, recY + rh - 1.1, 180, { w: dk })); I.push(furn("chairO", cE - 0.3, recY + 0.3)); } }
    let placedG = 0;
    const putLounge = (x, y) => { if (p.compact) { I.push(furn("sofa3", x, y + gh - 0.9, 180)); I.push(furn("ctab", x + 0.5, y)); } else I.push(furn("lounge", x, y)); };
    for (const it of seq) {
      if (it.t === "kids") { I.push(room(kidR0.name, it.x, y1 - kh, kw, kh, "client", "none", { sub: true, color: "#F4D36B" })); I.push(furn("kidmat", it.x + 0.2, y1 - Math.min(1.6, kh - 0.4) - 0.2, 0, { w: Math.min(1.8, kw - 0.4), h: Math.min(1.6, kh - 0.4) })); if (kw >= 3) I.push(furn("kidtab", it.x + kw - 1.3, y1 - kh + 0.2)); }
      if (it.t === "cafe") { I.push(room(cafR.name, it.x, y1 - ch, cw, ch, "client", "none", { sub: true, color: "#D9B98E" })); I.push(furn("bar", it.x + 0.2, y1 - ch + 0.2, 0, { w: cw - 0.4 })); if (ch >= 3) I.push(furn("cafe4", it.x + cw / 2 - 0.95, y1 - 2.2)); }
      if (it.t === "maket") { const my = y1 - 0.6 - mh; I.push(room("Зона макета", it.x, my, mw, mh, "client", "none", { sub: true, color: "#F2F0EA" })); I.push(furn("model", it.x + gap, my + gap, 0, { w: mk[0], h: mk[1] })); }
      if (it.t === "lounge") { putLounge(it.x, y1 - 0.4 - gh); I.push(room(lounge.name || "Зона ожидания", it.x - 0.2, y1 - gh - 0.6, gw + 0.4, gh + 0.6, "client", "none", { sub: true, color: "#F3E6CF" })); placedG++; }
    }
    if (inner) { // макет в глубине зала: у витража остаётся полоса ожидания; сторона — где больше места от ресепшен
      const my = y1 - (p.compact ? gh + 0.6 : 3.5) - 1.0 - mh, rL = recX, rR = recX + rw;
      const leftX = rL - 0.8 - mw, rightX = rR + 0.8, fitsX = x => x >= x0 + 0.3 && x + mw <= xP - 0.3;
      let mx = my + mh < recY - 0.2 ? Math.max(x0 + 0.3, Math.min(cE - mw / 2, xP - 0.3 - mw)) : (fitsX(leftX) && (!fitsX(rightX) || cE - x0 > xP - cE) ? leftX : (fitsX(rightX) ? rightX : Math.max(x0 + 0.3, leftX)));
      I.push(room("Зона макета", mx, my, mw, mh, "client", "none", { sub: true, color: "#F2F0EA" })); I.push(furn("model", mx + gap, my + gap, 0, { w: mk[0], h: mk[1] })); }
    if (placedG < groups) { // остальные мягкие зоны — в свободных местах зала
      const occ = I.filter(i => (i.lv || 0) === 0 && (i.t === "item" || (i.t === "room" && i.name !== "Зал продаж"))).map(i => { const q = (i.rot || 0) % 180 ? [i.h, i.w] : [i.w, i.h]; return [i.x, i.y, q[0], q[1]]; });
      const hit = (x, y, w, h, m) => occ.some(([a, b, c, d]) => x < a + c + m && x + w + m > a && y < b + d + m && y + h + m > b);
      for (let y = y1 - 0.4 - gh; y >= yP + 0.3 && placedG < groups; y -= 0.4)
        for (let x = x0 + 0.4; x + gw <= xP - 0.4 && placedG < groups; x += 0.4) {
          if (x + 2.2 > cE - 1.6 && x < cE + 1.6) continue;           // ось входа свободна
          if (hit(x, y, gw, gh, p.compact ? 0.4 : 0.5)) continue;
          putLounge(x, y); I.push(room(lounge.name || "Зона ожидания", x - 0.2, y - 0.2, gw + 0.4, gh + 0.4, "client", "none", { sub: true, color: "#F3E6CF" }));
          occ.push([x, y, gw, gh]); placedG++; }
    }
    if (placedG < groups) warn.push(`Мягких зон в зале: ${placedG} из ${groups} (мест ${placedG * per} из ${lounge.seats}).`);
    if (openDesks && deskHall) { // открытые места консультаций, не поместившиеся вдоль стены — в свободных местах зала, ближе к проходу
      const occ = I.filter(i => (i.lv || 0) === 0 && (i.t === "item" || (i.t === "room" && !/Зал продаж|Проход/.test(i.name)))).map(i => { const q = (i.rot || 0) % 180 ? [i.h, i.w] : [i.w, i.h]; return [i.x, i.y, q[0], q[1]]; });
      const hit = (x, y, w, h, m) => occ.some(([a, b, c, d]) => x < a + c + m && x + w + m > a && y < b + d + m && y + h + m > b);
      const dw = cabR.w || 2.8, dh = cabR.h || 2.6, needD = deskHall; let placedD = 0;
      for (let y = yA + 0.1; y + dh <= y1 - 0.3 && placedD < needD; y += 0.4)
        for (let x = x0 + 0.3; x + dw <= xP - 0.3 && placedD < needD; x += 0.4) {
          if (x + dw > cE - 1.2 && x < cE + 1.2 && y + dh > recY - 0.5) continue;
          if (hit(x, y, dw, dh, p.compact ? 0.3 : 0.5)) continue;
          I.push(room(cabR.name, x, y, dw, dh, cabR.cat, "none", { sub: true, color: cabR.color || KB.CAT[cabR.cat].c }));
          I.push(furn("work3", x + dw / 2 - 0.8, y + Math.max(0.1, (dh - 2.3) / 2)));
          occ.push([x, y, dw, dh]); placedD++; }
      if (placedD < needD) warn.push(`Мест консультации: не поместилось ${needD - placedD} из ${cabR.n}.`);
    }
    if (get("media")) { I.push(room("Медиа / VR зона", x0, yP + 0.2, 3, Math.max(2, Math.min(4, y1 - 3.7 - yP)), "client", "none", { sub: true })); I.push(furn("led", x0, yP + 0.8, 90)); }
    I.push(furn("plant", x0 + 0.1, yA + 0.1)); I.push(furn("plant", xP - 0.8, y1 - 0.8)); I.push(furn("cooler", xs - 0.5, yA + 0.2));

    // антресоль над правым торцом: над сервисным блоком и служебной частью заднего ряда
    let mA = 0;
    if (mezz) {
      const inner = Lin * Din, cap = Math.min(0.38 * inner, 290) / Din;
      const stairX = x1 - 2.8, L1 = { lv: 1 }, xm = Math.min(stairX - 3.2, Math.max(Math.min(xs, svcX), x1 - cap)), Lm = x1 - xm;
      mA = Lm * (rowD + aisle + dfS);
      if (mA / inner > 0.4) warn.push(`Антресоль ${Math.round(mA / inner * 100)}% площади — больше 40%, проектировщик может посчитать её этажом.`);
      // задний ряд антресоли: [до лестницы: кабинет руководителя / архив] [площадка лестницы] [после: серверная / архив]
      const mb = []; const before = stairX - xm, after = x1 - (stairX + 2.8);
      if (before >= 3) mb.push({ key: dir ? "director" : "server", name: dir ? dir.name : "Серверная / архив", cat: dir ? "back" : "service", border: "wall", w: before, color: dir ? dir.color : null });
      else if (before > 0.05) mb.push({ key: "void", name: "Проход", cat: "circ", border: "none", w: before });
      mb.push({ key: "pad", name: "Площадка лестницы", cat: "circ", border: "none", w: 2.8 });
      if (after >= 1.5) mb.push({ key: dir && before < 3 ? "director" : "server", name: dir && before < 3 ? dir.name : "Серверная / архив", cat: dir && before < 3 ? "back" : "service", border: "wall", w: after, color: dir && before < 3 ? dir.color : null });
      const MB = place(mb, xm, y0, rowD, 1);
      I.push(room("Холл-галерея", xm, y0 + rowD, Lm, aisle, "circ", "none", L1));
      const hasServer = mb.some(r => r.key === "server");
      const MF = place(hasServer || Lm < 6 ? [{ key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Lm }]
        : [{ key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Lm - 2.0 }, { key: "server", name: "Серверная / архив", cat: "service", border: "wall", w: 2.0 }], xm, yA, dfS, 1);
      I.push(furn("stair2", stairX + 0.1, y0, 0, Object.assign({ label: "проём", h: Math.min(4, rowD + aisle - 0.2) }, L1)));
      I.push({ id: uid(), t: "wall", lv: 1, kind: "rail", x1: xm, y1: y0 + rowD, x2: xm, y2: yA, th: 0.05 });
      if (MB[0] && MB[0]._key === "void") I.push({ id: uid(), t: "wall", lv: 1, kind: "rail", x1: xm, y1: y0, x2: xm, y2: y0 + rowD, th: 0.05 });
      for (const r of MB) { if (r._key === "pad" || r._key === "void") continue; I.push(door(r, "s", 0.3, r._key === "server" ? 0.8 : 0.9, true));
        if (r._key === "director") { const [cx, cy] = center(r, 1.8, 0.9); I.push(furn("deskB", cx, cy, 0, L1)); I.push(furn("chairO", cx + 0.6, cy - 0.7, 0, L1)); }
        if (r._key === "server") I.push(furn("shelf", r.x + 0.1, r.y + 0.1, 0, Object.assign({ w: Math.min(1.8, r.w - 0.2) }, L1))); }
      for (const r of MF) { I.push(door(r, "n", 0.3, r._key === "server" ? 0.8 : 0.9, true)); if (r._key === "backoffice") fillOpen(r); else I.push(furn("shelf", r.x + 0.1, r.y + r.h - 0.5, 0, Object.assign({ w: 1.8 }, L1))); }
      if ((Lm - (hasServer ? 0 : 2)) * dfS < bo.area * 0.95) warn.push(`Бэк-офис на антресоли ${(Lm * dfS).toFixed(0)} м² меньше цели ${bo.area} м².`);
    }

    const project = {
      v: 1, name: p.name || "Офис продаж", notes: "", b: { w: W, d: D, h: H, mz: mz, front: p.front || "vitrage" },
      items: I.map(({ _key, ...it }) => it),
      program: rows.map(r => ({ key: r.key, name: r.name, zone: r.zone, cat: r.cat, n: r.n, area: r.area, status: r.status, rule: r.rule, sub: !!r.sub })),
      meta: { generator: "office-kb " + KB.version, params: p, mezz, warnings: warn },
    };
    return { project, warnings: warn, program: rows, mezz };
  };

  /* ------------------------------------------------------------ программа: цель / факт */
  const norm = s => String(s || "").toLowerCase().replace(/ё/g, "е");
  const MATCH = {
    tambour: ["тамбур"], reception: ["ресепшен", "ресепшн", "хостес"], lounge: ["ожидан", "лаунж"], maket: ["макет"], kids: ["детск"],
    cafe: ["кофе", "бар", "кафе"], wardrobe: ["гардероб"], media: ["медиа", "vr"], cabinet: ["кабинет менеджер", "место консультац"], meet: ["переговорн"],
    bank: ["ипотек", "банк"], showroom: ["шоурум"], vip: ["сделочн", "vip"], archive: ["архив"], storage: ["склад"], security: ["охран"], cashier: ["касса"], wcv: ["с/у посетит", "с/у мгн", "санузел посетит", "санузел универсал"], stair: ["лестнич"],
    backoffice: ["бэк-офис", "бэк офис", "back"], director: ["руководител", "роп"], kitchen: ["кухн", "приём пищи", "прием пищи", "отдыха"],
    wcs: ["с/у персонал"], kui: ["куи", "уборочн"], elec: ["электрощит"], server: ["сервер", "архив"],
  };
  KB.programFact = function (S) {
    const prog = S.program || []; const rooms = (S.items || []).filter(i => i.t === "room");
    return prog.map(pr => {
      const keys = MATCH[pr.key] || [norm(pr.name).slice(0, 8)];
      const hit = rooms.filter(r => keys.some(k => norm(r.name).includes(k)) && !(pr.key === "meet" && norm(r.name).includes("vip")));
      const area = hit.reduce((s, r) => s + r.w * r.h, 0), target = pr.n * pr.area;
      return { ...pr, placed: hit.length, factArea: +area.toFixed(1), targetArea: +target.toFixed(1),
        state: hit.length < pr.n ? (hit.length === 0 ? "red" : "yellow") : (area < target * 0.9 ? "yellow" : "ok") };
    });
  };

  /* ------------------------------------------------------------ проверки норм (мягкие) */
  KB.checks = function (S) {
    const out = [], b = S.b || {}, items = S.items || [];
    const rooms = items.filter(i => i.t === "room"), R = (lv) => rooms.filter(r => (r.lv || 0) === lv);
    const add = (level, text, ref, id) => out.push({ level, text, ref, id });
    const area = r => r.w * r.h, has = (r, s) => norm(r.name).includes(s);
    const inner = Math.max(0, (b.w - 0.6) * (b.d - 0.6));
    // МГН санузел
    const wcv = rooms.filter(r => has(r, "с/у посетит") || has(r, "мгн"));
    if (!wcv.length && rooms.length) add("red", "Нет санузла для посетителей с универсальной кабиной МГН.", "СП 59.13330.2020 п. 6.3.2");
    for (const r of wcv) if (Math.min(r.w, r.h) < 2.2 || Math.max(r.w, r.h) < 2.25) add("red", `«${r.name}»: меньше 2,20×2,25 м — универсальная кабина МГН не помещается.`, "СП 59.13330.2020 табл. 6.1", r.id);
    // Тамбур
    for (const r of rooms.filter(r => has(r, "тамбур"))) if (r.h < 2.45) add("yellow", `Тамбур: глубина по ходу движения ${r.h.toFixed(2)} м < 2,45 м.`, "СП 59.13330.2020 п. 6.1.8 (сверить редакцию)", r.id);
    // Антресоль
    const m = R(1).filter(r => !r.sub), mA = m.reduce((s, r) => s + area(r), 0);
    if (m.length && b.upper === "floor") {
      if (!items.some(i => i.t === "item" && /^stair/.test(i.k)) && !items.some(i => i.t === "room" && /лестниц/i.test(i.name))) add("info", "Лестница на 2 этаж в плане не показана (если она снаружи — ок).", "СП 1.13130.2020");
    } else if (m.length) {
      if (b.h < 4.7) add("red", `Высота зала ${b.h} м < 4,7 м — антресоль невозможна.`, "СП 118.13330.2022 п. 4.26");
      if (b.h - b.mz < 2.2) add("red", `Над антресолью ${(b.h - b.mz).toFixed(2)} м < 2,2 м.`, "СП 118.13330.2022 п. 4.26");
      if (b.mz - 0.3 < 2.2) add("red", `Под антресолью ${(b.mz - 0.3).toFixed(2)} м < 2,2 м.`, "СП 118.13330.2022 п. 4.26");
      const share = inner ? mA / inner : 0;
      if (share >= 0.4) add("red", `Антресоль ${Math.round(share * 100)}% площади помещения — может считаться этажом.`, "СП 118.13330.2022 п. 3.1.2");
      else if (share >= 0.35) add("yellow", `Антресоль ${Math.round(share * 100)}% — близко к пределу 40%.`, "СП 118.13330.2022 п. 3.1.2");
      if (mA > 300) add("red", "Антресоль больше 300 м² — нужна вторая лестница.", "СП 1.13130.2020 п. 4.2.7");
      if (!items.some(i => i.t === "item" && /^stair/.test(i.k))) add("red", "На антресоль нет лестницы.", "СП 1.13130.2020 п. 4.4");
      for (const r of m) if (["client", "meet", "office"].includes(r.cat)) add("yellow", `«${r.name}» — клиентское помещение на антресоли: нужен подъёмник для МГН или перенос вниз.`, "СП 59.13330.2020", r.id);
      if (!items.some(i => i.t === "wall" && i.lv === 1 && i.kind === "rail")) add("yellow", "На краю антресоли нет ограждения (h ≥ 1,2 м).", "СП 118.13330.2022 п. 6.12");
    }
    // Бэк-офис: площадь на рабочее место
    const seatsOf = it => ({ os1: 1, os4: 4, work3: 1 }[it.k] || 0);
    for (const r of rooms.filter(r => has(r, "бэк-офис"))) {
      const n = items.filter(i => i.t === "item" && (i.lv || 0) === (r.lv || 0) && i.x >= r.x - .01 && i.y >= r.y - .01 && i.x <= r.x + r.w && i.y <= r.y + r.h).reduce((s, i) => s + seatsOf(i), 0);
      if (n && area(r) / n < 4.5) add("yellow", `«${r.name}»: ${(area(r) / n).toFixed(1)} м² на рабочее место < 4,5 м².`, "МР 2.2.0244-21 (рекомендация)", r.id);
    }
    // Кухня
    const par = (S.meta && S.meta.params) || null;
    if (par) { const staff = par.M + par.B + (par.director ? 1 : 0) + 1, need = staff <= 10 && par.pkg ? 6 : Math.max(12, staff); const k = rooms.filter(r => has(r, "кухн") || has(r, "приём пищи"));
      const kA = k.reduce((s, r) => s + area(r), 0); if (kA + 0.01 < need) add("yellow", `Кухня ${kA.toFixed(1)} м² < ${need} м² (${staff} чел. в смене).`, "СП 44.13330.2011 п. 5.51–5.52 (сверить)"); }
    // Кабинет приёма
    for (const r of rooms.filter(r => has(r, "кабинет менеджер"))) if (area(r) < 9) add("info", `«${r.name}» ${area(r).toFixed(1)} м² — тесно для приёма клиентов (реком. ≥ 9–12 м²).`, "СП 118.13330.2022 п. 5.31 (рекомендация)", r.id);
    // Коридоры
    for (const r of rooms.filter(r => has(r, "коридор") || has(r, "галерея"))) { const w = Math.min(r.w, r.h); if (w < 1.2) add("red", `«${r.name}» шириной ${w.toFixed(2)} м < 1,2 м.`, "СП 1.13130.2020 п. 4.3.4", r.id); else if (w < 1.5) add("yellow", `«${r.name}» ${w.toFixed(2)} м: для разъезда кресел нужно ≥ 1,5–1,8 м.`, "СП 59.13330.2020 п. 6.2.1", r.id); }
    // Геометрия: за контуром здания и пересечения
    for (const r of rooms) if (r.x < -0.01 || r.y < -0.01 || r.x + r.w > b.w + 0.01 || r.y + r.h > b.d + 0.01) add("red", `«${r.name}» выходит за контур здания.`, "геометрия", r.id);
    for (const lv of [0, 1]) { const rs = R(lv).filter(r => !r.sub && !has(r, "зал"));
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], c = rs[j];
        const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (ox > 0.15 && oy > 0.15) add("yellow", `«${a.name}» и «${c.name}» перекрываются.`, "геометрия", a.id); } }
    // Программа
    if (S.program && S.program.length) for (const f of KB.programFact(S)) {
      if (f.placed < f.n) add(f.status === "обязательно" ? "red" : "info", `Программа: «${f.name}» ${f.placed} из ${f.n}.`, "программа помещений");
      else if (f.state === "yellow") add("info", `Программа: «${f.name}» ${f.factArea} м² при цели ${f.targetArea} м².`, "программа помещений");
    }
    const order = { red: 0, yellow: 1, info: 2 };
    return out.sort((a, c) => order[a.level] - order[c.level]);
  };

  /* ------------------------------------------------------------ текстовая сводка (для Claude и CLI) */
  KB.summary = function (S) {
    const rooms = (S.items || []).filter(i => i.t === "room" && !i.sub);
    const a0 = rooms.filter(r => !r.lv).reduce((s, r) => s + r.w * r.h, 0), a1 = rooms.filter(r => r.lv === 1).reduce((s, r) => s + r.w * r.h, 0);
    const lines = [`${S.name}: здание ${S.b.w}×${S.b.d}×${S.b.h} м, 1 этаж ${a0.toFixed(1)} м², ${S.b.upper === "floor" ? "2 этаж" : "антресоль"} ${a1.toFixed(1)} м²`];
    if (S.program) { lines.push("Программа (цель → факт):"); for (const f of KB.programFact(S)) lines.push(`  ${f.state === "ok" ? "✓" : f.state === "yellow" ? "~" : "✗"} ${f.name}: ${f.placed}/${f.n} шт, ${f.factArea}/${f.targetArea} м²`); }
    const ch = KB.checks(S); lines.push(`Проверки: ${ch.filter(c => c.level === "red").length} красных, ${ch.filter(c => c.level === "yellow").length} жёлтых`);
    for (const c of ch) lines.push(`  [${c.level}] ${c.text} (${c.ref})`);
    return lines.join("\n");
  };

  /* ============================================================ КОМАНДЫ ПЛАНИРОВЩИКА (для Claude / MCP / ИИ-помощника)
   * Все команды меняют проект S на месте и возвращают { ok, msg, ids }.
   * Помещение или предмет указывается id или названием («Кабинет менеджера 2», «кухня»).
   * Координаты — метры от левого верхнего угла здания: X вдоль дороги, Y вглубь, фасад с витражом — Y = b.d.
   */
  const isDoorK = k => /^(door|slide|auto|win)/.test(k || "");
  const aabbOf = it => { if (it.t !== "item") return { x: it.x, y: it.y, w: it.w, h: it.h };
    const q = (it.rot || 0) % 180 !== 0; return { x: it.x, y: it.y, w: q ? it.h : it.w, h: q ? it.w : it.h }; };
  KB.aabb = aabbOf;
  const lvOf = it => it.lv || 0;
  const inside = (a, r, m = 0) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; return cx >= r.x - m && cx <= r.x + r.w + m && cy >= r.y - m && cy <= r.y + r.h + m; };
  const overlap = (a, c, m = 0) => a.x < c.x + c.w + m && a.x + a.w + m > c.x && a.y < c.y + c.h + m && a.y + a.h + m > c.y;
  const isHall = r => /зал|холл|open-space продаж/i.test(r.name || "") && !r.sub;
  const isCirc = r => r.cat === "circ" || /проход|коридор|галерея/i.test(r.name || "");

  /* Типы помещений: как распознать по названию, категория, ограждение, типовой размер и наполнение. */
  KB.ROOM_TYPES = [
    { key: "tambour", re: /тамбур/, cat: "circ", border: "glass", size: [2.6, 2.5] },
    { key: "reception", re: /ресепшен|хостес|стойка/, cat: "client", border: "none", size: [4.4, 2.2], zone: true },
    { key: "kids", re: /детск/, cat: "client", border: "none", size: [3.5, 3.5], zone: true, color: "#F4D36B" },
    { key: "maket", re: /макет/, cat: "client", border: "none", size: [7.4, 5.4], zone: true, color: "#F2F0EA" },
    { key: "cafe", re: /кофе|бар|кафе/, cat: "client", border: "none", size: [4, 3.2], zone: true, color: "#D9B98E" },
    { key: "lounge", re: /ожидан|лаунж|мягк/, cat: "client", border: "none", size: [5, 4], zone: true },
    { key: "media", re: /медиа|vr/, cat: "client", border: "none", size: [3.5, 3], zone: true },
    { key: "showroom", re: /шоурум|материал/, cat: "client", border: "glass", size: [5, 3.2] },
    { key: "wardrobe", re: /гардероб/, cat: "staff", border: "wall", size: [2, 3.2] },
    { key: "opendesk", re: /место консультац|open-space продаж/, cat: "office", border: "none", size: [2.8, 2.6], zone: true },
    { key: "bank", re: /ипотек|банк|брокер|юрист/, cat: "office", border: "glass", size: [3, 3.2] },
    { key: "cabinet", re: /кабинет менеджер|кабинет продаж|менеджер/, cat: "office", border: "glass", size: [3, 3.2] },
    { key: "vip", re: /сделочн|vip/, cat: "meet", border: "glass", size: [5, 4.5] },
    { key: "meet", re: /переговорн/, cat: "meet", border: "glass", size: [4.5, 3.2] },
    { key: "cashier", re: /касса/, cat: "service", border: "wall", size: [3, 3] },
    { key: "director", re: /руководител|роп|директор/, cat: "back", border: "wall", size: [4.5, 4] },
    { key: "backoffice", re: /бэк|back|бухгалтер|open-space/, cat: "back", border: "glass", size: [6, 5] },
    { key: "kitchen", re: /кухн|приём пищи|прием пищи|комната отдыха/, cat: "staff", border: "wall", size: [4, 3.5] },
    { key: "wcv", re: /мгн|посетит|универсал/, cat: "wc", border: "wall", size: [2.4, 2.4], color: "#CFE8E6", wc: true },
    { key: "wcs", re: /с\/у|санузел|туалет|wc/, cat: "wc", border: "wall", size: [1.8, 2.5], color: "#CFE8E6", wc: true },
    { key: "kui", re: /куи|уборочн/, cat: "service", border: "wall", size: [1.8, 2] },
    { key: "elec", re: /электрощит|щитов|слаботоч/, cat: "service", border: "wall", size: [2, 2.5] },
    { key: "server", re: /сервер/, cat: "service", border: "wall", size: [2, 2.5] },
    { key: "archive", re: /архив|склад|кладов/, cat: "service", border: "wall", size: [2.5, 3] },
    { key: "security", re: /охран/, cat: "service", border: "wall", size: [2, 2] },
    { key: "stair", re: /лестниц/, cat: "circ", border: "wall", size: [2.8, 5.1] },
    { key: "corridor", re: /коридор|проход|галерея/, cat: "circ", border: "none", size: [1.8, 6], zone: true },
    { key: "hall", re: /зал|холл/, cat: "client", border: "none", size: [12, 8], zone: true, color: "#EDE8DE" },
  ];
  KB.roomType = function (name) {
    const n = norm(name);
    // «с/у посетителей», «с/у МГН» — посетительский; любой другой с/у — персонала
    for (const t of KB.ROOM_TYPES) if (t.re.test(n)) { if (t.key === "wcv" && !/с\/у|санузел|туалет|wc|кабин/.test(n)) continue; return t; }
    return null;
  };

  /* ---------- поиск элементов */
  function findEl(S, ref, t) {
    if (ref == null || ref === "") throw new Error("Не указан элемент (id или название).");
    const pool = S.items.filter(i => !t || i.t === t);
    const byId = pool.find(i => i.id === String(ref)); if (byId) return byId;
    const n = norm(ref).trim();
    const label = i => norm(i.t === "room" ? i.name : i.t === "item" ? (i.label || (KB.FK[i.k] ? KB.FK[i.k].n : i.k)) : i.kind);
    let hit = pool.filter(i => label(i) === n); if (hit.length === 1) return hit[0];
    if (!hit.length) hit = pool.filter(i => label(i).includes(n));
    if (hit.length === 1) return hit[0];
    if (!hit.length) throw new Error(`Не найдено: «${ref}». Посмотрите список в describe_plan.`);
    throw new Error(`«${ref}» — несколько совпадений: ${hit.slice(0, 8).map(i => `${i.id} (${i.t === "room" ? i.name : i.k} @ ${(+i.x || 0).toFixed(1)},${(+i.y || 0).toFixed(1)})`).join("; ")}. Укажите id.`);
  }
  KB.findEl = findEl;
  // Предметы внутри помещения (центр внутри; двери — с допуском на толщину стены)
  KB.contents = function (S, r) {
    return S.items.filter(i => i !== r && lvOf(i) === lvOf(r) && (i.t === "item" ? inside(aabbOf(i), r, isDoorK(i.k) ? 0.35 : 0)
      : i.t === "room" ? (i.sub && !r.sub && inside(i, r) && i.w * i.h < r.w * r.h) : false));
  };

  /* ---------- сторона двери: где снаружи проход / зал, а не другое помещение и не наружная стена */
  function sideScore(S, r, side) {
    const b = S.b, lv = lvOf(r), e = 0.35;
    const mid = side === "n" ? [r.x + r.w / 2, r.y - e] : side === "s" ? [r.x + r.w / 2, r.y + r.h + e] : side === "w" ? [r.x - e, r.y + r.h / 2] : [r.x + r.w + e, r.y + r.h / 2];
    const [px, py] = mid;
    if (px < 0.3 || py < 0.3 || px > b.w - 0.3 || py > b.d - 0.3) return -10;          // наружу
    const here = S.items.filter(i => i.t === "room" && i !== r && lvOf(i) === lv && px > i.x && px < i.x + i.w && py > i.y && py < i.y + i.h);
    if (!here.length) return lv ? -5 : 2;                                                  // открытое пространство (на антресоли — пустота)
    const solid = here.filter(i => !i.sub && !isHall(i) && !isCirc(i));
    if (solid.length) return -3;
    if (here.some(isCirc)) return 4;
    if (here.some(isHall)) return 3;
    return 1;                                                                              // зона без стен
  }
  KB.doorSide = function (S, r) {
    let best = "s", bs = -1e9;
    for (const s of ["s", "n", "e", "w"]) { const v = sideScore(S, r, s) + ((s === "n" || s === "s") ? (r.w >= r.h ? 0.3 : 0) : (r.h > r.w ? 0.3 : 0)); if (v > bs) { bs = v; best = s; } }
    return best;
  };
  // Сторона, обращённая к входу/фасаду — для зон без стен (ресепшен, макет смотрят на посетителя)
  function faceSide(S, r) {
    const ent = S.items.find(i => i.t === "item" && lvOf(i) === 0 && (i.k === "auto" || /вход/i.test(i.label || "")) && !/служеб/i.test(i.label || ""));
    const tx = ent ? ent.x + aabbOf(ent).w / 2 : r.x + r.w / 2, ty = ent ? ent.y : S.b.d;
    const dx = tx - (r.x + r.w / 2), dy = ty - (r.y + r.h / 2);
    return Math.abs(dy) >= Math.abs(dx) * 0.8 ? (dy > 0 ? "s" : "n") : (dx > 0 ? "e" : "w");
  }

  /* ---------- локальная система помещения: u — вдоль «лицевой» стены, v — от задней стены к лицевой.
   * face: n|s|e|w — лицевая сторона (дверь / обзор). Предмет в локальных координатах: ставим по центру (cu, cv) с поворотом rl. */
  function frame(r, face) {
    const Wl = face === "n" || face === "s" ? r.w : r.h, Dl = face === "n" || face === "s" ? r.h : r.w;
    const toW = (cu, cv) => face === "s" ? [r.x + cu, r.y + cv, 0] : face === "n" ? [r.x + r.w - cu, r.y + r.h - cv, 180]
      : face === "e" ? [r.x + cv, r.y + r.h - cu, 270] : [r.x + r.w - cv, r.y + cu, 90];
    return { W: Wl, D: Dl, put(k, u, v, rl = 0, o = {}) {   // u, v — левый-задний угол предмета в локальных координатах
      const f = KB.FK[k] || { w: 1, h: 1 }, w = o.w || f.w, h = o.h || f.h;
      const lw = rl % 180 ? h : w, lh = rl % 180 ? w : h;
      const [cx, cy, ra] = toW(u + lw / 2, v + lh / 2), rot = (rl + ra) % 360, q = rot % 180 !== 0;
      const aw = q ? h : w, ah = q ? w : h;
      return Object.assign({ id: uid(), t: "item", lv: lvOf(r), k, x: r3(cx - aw / 2), y: r3(cy - ah / 2), w, h, rot, flip: false, label: "" }, o, { w, h });
    } };
  }
  function slideDoor(r, side, off) {
    const lv = lvOf(r);
    if (side === "s") return { id: uid(), t: "item", lv, k: "slide", x: r3(r.x + off), y: r3(r.y + r.h - 0.15), w: 1, h: 0.3, rot: 0, flip: false, label: "" };
    if (side === "n") return { id: uid(), t: "item", lv, k: "slide", x: r3(r.x + off), y: r3(r.y - 0.15), w: 1, h: 0.3, rot: 0, flip: false, label: "" };
    if (side === "e") return { id: uid(), t: "item", lv, k: "slide", x: r3(r.x + r.w - 0.15), y: r3(r.y + off), w: 1, h: 0.3, rot: 90, flip: false, label: "" };
    return { id: uid(), t: "item", lv, k: "slide", x: r3(r.x - 0.15), y: r3(r.y + off), w: 1, h: 0.3, rot: 90, flip: false, label: "" };
  }

  /* ---------- автоматическое наполнение помещения мебелью по его типу */
  KB.furnishRoom = function (S, r, o = {}) {
    const T = KB.roomType(r.name) || { key: "other" }, out = [], lv = lvOf(r);
    const zone = r.border === "none";
    const face = o.face || (zone ? faceSide(S, r) : KB.doorSide(S, r));
    const F = frame(r, face), W = F.W, D = F.D, P = (...a) => out.push(F.put(...a));
    const cU = w => Math.max(0.1, (W - w) / 2);
    // дверь (если у помещения есть стены)
    if (!zone && o.door !== false && T.key !== "stair") {
      const along = face === "n" || face === "s" ? r.w : r.h, dw = T.key === "wcv" ? 1.0 : (T.wc || /куи|щит|сервер/.test(T.key) ? 0.8 : 0.9);
      const off0 = Math.min(0.3, Math.max(0.05, along - dw - 0.05)), off = face === "n" || face === "e" ? Math.max(0.05, along - dw - off0) : off0; // дверь всегда слева в локальной системе
      const inward = !(T.wc || T.key === "kui" || T.key === "elec" || T.key === "server" || T.key === "archive");
      out.push(r.border === "glass" && T.key !== "vip" && T.key !== "meet" && T.key !== "showroom" ? slideDoor(r, face, off) : door(r, face, off, dw, inward));
    }
    const doorZone = 1.1; // у лицевой стены возле двери оставляем свободно
    switch (T.key) {
      case "cabinet": case "bank": case "opendesk":
        P("work3", cU(1.6), zone ? Math.max(0.1, (D - 2.3) / 2) : Math.min(0.4, Math.max(0.05, D - 2.3 - 0.9)));
        if (!zone && W >= 3.6) P("cab", W - 0.95, 0.05); break;
      case "meet": case "vip": {
        const opts = [["meet10", 4, 2.2], ["meet8", 3.2, 2.2], ["meet6", 2.4, 2.1], ["round4", 1.9, 1.9]];
        let fitT = opts[3], rl = 0;
        for (const t of (T.key === "vip" ? opts.slice(1) : opts)) { if (t[1] + 1.4 <= W && t[2] + 1.0 <= D) { fitT = t; rl = 0; break; } if (t[2] + 1.0 <= W && t[1] + 1.4 <= D) { fitT = t; rl = 90; break; } }
        const lw = rl ? fitT[2] : fitT[1], lh = rl ? fitT[1] : fitT[2];
        P(fitT[0], cU(lw), Math.max(0.5, (D - lh) / 2 - (D - lh > 1.6 ? 0.2 : 0)), rl);
        if (W >= 4 && D - lh >= 2.2) P("led", cU(2), 0.02);
        if (T.key === "vip" && W - lw >= 3.4) P("sofa2", 0.15, 0.1, 90);
        break; }
      case "director": {
        P("cab", 0.1, 0.05); if (W >= 4) P("cab", W - 1.0, 0.05);
        P("chairO", cU(0.6), 0.6, 180); P("deskB", cU(1.8), 1.25); P("chairV", W / 2 - 0.75, 2.3); P("chairV", W / 2 + 0.25, 2.3);
        if (D >= 4.6 && W >= 4.2) P("round4", W - 2.1, D - doorZone - 1.9 > 2.6 ? D - doorZone - 1.9 : 2.8);
        break; }
      case "backoffice": {
        const need = o.seats || Math.max(1, Math.floor(r.w * r.h / 6)); let seats = 0;
        const cols4 = Math.floor((W - 0.6) / 3.6), rows4 = Math.floor((D - doorZone - 0.5) / 3.4);
        for (let j = 0; j < rows4 && seats + 2 < need; j++) for (let i = 0; i < cols4 && seats + 2 < need; i++) { P("os4", 0.4 + i * 3.6, 0.5 + j * 3.4); seats += 4; }
        const y1 = rows4 && seats ? 0.5 + Math.ceil(seats / 4 / Math.max(1, cols4)) * 3.4 : 0.3;
        for (let v = y1; v + 1.3 <= D - doorZone + 0.2 && seats < need; v += 1.9) for (let u = 0.3; u + 1.4 <= W - 0.2 && seats < need; u += 1.6) { P("os1", u, v); seats++; }
        if (W >= 3.2) { P("mfp", W - 1.7, D - 0.55); P("cab", W - 1.0, D - 0.5); }
        out._note = `рабочих мест: ${seats}${need > seats ? ` из ${need}` : ""}`; break; }
      case "kitchen": {
        const kw = Math.min(2.4, W - 0.9); P("kitch", 0.1, 0.02, 0, { w: kw }); P("fridge", Math.min(W - 0.75, kw + 0.15), 0.02);
        if (D - 0.6 - doorZone >= 2.1 && W >= 2.4) P("dine", cU(1.9), 0.9 + Math.max(0, (D - 0.9 - doorZone - 1.9) / 2));
        else P("desk", cU(Math.min(1.6, W - 0.6)), 0.9, 0, { w: Math.min(1.6, W - 0.6), label: "стол" });
        break; }
      case "wcv": P("wc", 0.9, 0.05); P("sink", W - 0.6, Math.min(1.2, D - 1.5), 90);
        if (W >= 3.6) { P("cubicle", W - 1.3, 0.05); P("wc", W - 0.9, 0.1); } break;
      case "wcs": P("wc", Math.min(0.6, W - 0.5), 0.05); P("sink", W - 0.5, Math.min(1.0, D - 1.3), 90); break;
      case "kui": case "server": case "archive": P("shelf", 0.1, 0.05, 0, { w: Math.max(0.6, Math.min(W - 0.2, 3)) });
        if (T.key === "archive" && D >= 2.6 && W >= 2) P("shelf", 0.05, 0.6, 90, { w: Math.min(D - 1.6, 3) }); break;
      case "elec": P("cab", 0.1, 0.05, 0, { w: Math.max(0.6, Math.min(W - 0.2, 1.8)), label: "щиты" }); break;
      case "security": case "cashier": P("desk", 0.15, 0.1, 0, { w: Math.min(1.6, W - 0.4) }); P("chairO", 0.6, 0.95, 180);
        if (T.key === "cashier") P("safe", W - 0.6, 0.05); break;
      case "wardrobe": P("shelf", 0.1, 0.05, 0, { w: W - 0.2, label: "вешала" }); if (D >= 2.4) P("bench", cU(1.2), D - 1.3); break;
      case "reception": {
        const sw = Math.min(3, W - 0.6); P("recep", cU(sw), Math.max(0.9, D - 1.2), 0, { w: sw }); P("chairO", W / 2 - 0.3, Math.max(0.1, D - 2.0));
        if (W >= 4) P("cab", 0.1, 0.05); break; }
      case "lounge": {
        const gw = 2.4, gh = 3.1, nx = Math.max(1, Math.floor((W + 0.4) / (gw + 0.6))), ny = Math.max(1, Math.floor((D + 0.3) / (gh + 0.5)));
        if (W < 2.4 || D < 2.9) { P("sofa3", cU(2.2), 0.1); if (D >= 1.8) P("ctab", cU(1.2), 1.1); break; }
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) P("lounge", (W - nx * gw - (nx - 1) * 0.6) / 2 + i * (gw + 0.6), (D - ny * gh - (ny - 1) * 0.5) / 2 + j * (gh + 0.5));
        if (W >= 3) P("plant", W - 0.65, 0.05); break; }
      case "maket": {
        const M = [["6x4", 6, 4], ["5x3", 5, 3], ["3x2", 3, 2], ["2x1.5", 2, 1.5]];
        const pick = M.find(m => m[1] + 2.0 <= W && m[2] + 2.0 <= D) || M.find(m => m[1] + 1.2 <= W && m[2] + 1.2 <= D) || M[3];
        P("model", cU(pick[1]), (D - pick[2]) / 2, 0, { w: pick[1], h: pick[2], label: "макет " + pick[0].replace("x", "×") });
        if (D - pick[2] >= 2.6) P("stand", cU(1.2), 0.05); out._note = "макет " + pick[0]; break; }
      case "kids": P("kidmat", 0.2, 0.2, 0, { w: Math.min(2, W - 0.4), h: Math.min(2, D - 0.4) });
        if (W >= 3.2 && D >= 1.2) P("kidtab", W - 1.2, D - 0.8); break;
      case "cafe": { const bw = Math.min(3, W - 0.4); P("bar", cU(bw), 0.1, 0, { w: bw }); const ns = Math.max(1, Math.floor(bw / 0.75));
        for (let i = 0; i < ns; i++) P("stool", cU(bw) + 0.15 + i * (bw - 0.45) / Math.max(1, ns - 1), 0.9);
        if (D >= 4) P("cafe4", cU(1.9), D - 2.1); P("cooler", W - 0.45, 0.1); break; }
      case "media": P("media", cU(Math.min(4, W - 0.4)), 0.02, 0, { w: Math.min(4, W - 0.4) }); if (D >= 2.8) P("sofa3", cU(2.2), Math.min(D - 1.0, 2.4), 180); break;
      case "showroom": { const n = Math.max(1, Math.floor((W - 0.4) / 1.3)); for (let i = 0; i < n; i++) P("stand", 0.2 + i * 1.3, 0.05);
        if (D >= 3) P("ctab", cU(1.2), Math.min(D - 1.8, 1.5), 0, { label: "образцы" }); break; }
      case "hall": P("plant", 0.2, 0.2); P("plant", W - 0.8, 0.2); break;
      default: break;
    }
    // обрезаем то, что вылезло за помещение (кроме дверей)
    const bad = out.filter(i => !isDoorK(i.k) && (() => { const a = aabbOf(i); return a.x < r.x - 0.02 || a.y < r.y - 0.02 || a.x + a.w > r.x + r.w + 0.02 || a.y + a.h > r.y + r.h + 0.02; })());
    const res = out.filter(i => !bad.includes(i)); res._note = [out._note, bad.length ? `не поместилось предметов: ${bad.length}` : ""].filter(Boolean).join(", "); res._face = face;
    return res;
  };

  /* ---------- свободное место */
  KB.findSpace = function (S, o = {}) {
    const b = S.b, lv = o.lv || 0, w = +o.w, h = +o.h, m = o.margin == null ? 0.3 : +o.margin, step = o.step || 0.2, t = 0.3;
    if (!(w > 0 && h > 0)) throw new Error("find_space: нужны w и h (м).");
    const within = o.within ? findEl(S, o.within, "room") : null;
    const blocks = S.items.filter(i => lvOf(i) === lv && i !== within && (i.t === "item" ? true : i.t === "room" ? !isHall(i) && !(within && i.sub && !inside(i, within)) : false)).map(i => i.t === "wall" ? null : aabbOf(i)).filter(Boolean);
    const box = within ? { x: within.x, y: within.y, w: within.w, h: within.h } : { x: t, y: t, w: b.w - 2 * t, h: b.d - 2 * t };
    const res = [];
    for (let y = box.y; y + h <= box.y + box.h + 1e-6; y += step) for (let x = box.x; x + w <= box.x + box.w + 1e-6; x += step) {
      const a = { x, y, w, h }; if (blocks.some(c => overlap(a, c, within ? 0 : m) && !(c.w >= b.w - 1 && c.h >= b.d - 1))) continue;
      if (lv === 1 && !S.items.some(i => i.t === "room" && i.lv === 1 && !i.sub && inside(a, i))) continue; // на антресоли — только над перекрытием
      const cy = y + h / 2, cx = x + w / 2;
      const pref = o.near === "facade" ? b.d - cy : o.near === "back" ? cy : o.near === "left" ? cx : o.near === "right" ? b.w - cx : o.near === "center" ? Math.hypot(cx - b.w / 2, cy - b.d / 2) : cy * 0 + cx * 0.001;
      res.push({ x: r3(x), y: r3(y), w, h, score: pref });
    }
    res.sort((a, c) => a.score - c.score);
    const picked = []; for (const r of res) { if (picked.every(p => !overlap(p, r, 0.5))) picked.push(r); if (picked.length >= (o.limit || 5)) break; }
    return picked.map(({ score, ...r }) => r);
  };

  /* ---------- команды */
  const num = (v, name) => { const n = +v; if (!isFinite(n)) throw new Error(`Параметр ${name} должен быть числом (м).`); return n; };
  KB.OPS = {
    building(S, a) { for (const k of ["w", "d", "h", "mz"]) if (a[k] != null) S.b[k] = num(a[k], k); if (a.name) S.name = String(a.name); if (a.notes != null) S.notes = String(a.notes);
      return { msg: `Здание ${S.b.w}×${S.b.d}×${S.b.h} м` }; },
    add_room(S, a) {
      const T = KB.roomType(a.name) || {}, sz = T.size || [3, 3];
      const w = a.w != null ? num(a.w, "w") : sz[0], h = a.h != null ? num(a.h, "h") : sz[1];
      let x = a.x, y = a.y;
      if (x == null || y == null) { const sp = KB.findSpace(S, { w, h, lv: a.lv || 0, near: a.near || (T.cat === "client" ? "facade" : "back"), limit: 1 })[0];
        if (!sp) throw new Error(`Нет свободного места ${w}×${h} м для «${a.name}». Уменьшите размер или освободите место.`); x = sp.x; y = sp.y; }
      const cat = a.cat || T.cat || "client";
      const r = room(String(a.name || "Помещение"), num(x, "x"), num(y, "y"), w, h, cat, a.border || T.border || "wall",
        { lv: a.lv || 0, sub: a.sub != null ? !!a.sub : !!T.zone && !/^(hall|corridor)$/.test(T.key), color: a.color || T.color || (KB.CAT[cat] || KB.CAT.client).c });
      S.items.push(r); const ids = [r.id]; let note = "";
      if (a.furnish !== false) { const f = KB.furnishRoom(S, r); S.items.push(...f); ids.push(...f.map(i => i.id)); note = f._note ? ` (${f._note})` : ""; }
      return { msg: `Добавлено «${r.name}» ${r.w}×${r.h} м = ${(r.w * r.h).toFixed(1)} м² в (${r.x}; ${r.y}), id ${r.id}${a.furnish !== false ? ", мебель расставлена" : ""}${note}`, ids };
    },
    update(S, a) {
      const it = findEl(S, a.id || a.name || a.ref); const was = { ...it };
      const kids = it.t === "room" && a.move_contents !== false ? KB.contents(S, it) : [];
      if (it.t === "wall") { for (const k of ["x1", "y1", "x2", "y2"]) if (a[k] != null) it[k] = num(a[k], k); if (a.kind) it.kind = a.kind;
        if (a.dx || a.dy) { it.x1 += +a.dx || 0; it.x2 += +a.dx || 0; it.y1 += +a.dy || 0; it.y2 += +a.dy || 0; } return { msg: "Стена изменена", ids: [it.id] }; }
      for (const k of ["x", "y", "w", "h"]) if (a[k] != null) it[k] = r3(num(a[k], k));
      if (a.dx) it.x = r3(it.x + +a.dx); if (a.dy) it.y = r3(it.y + +a.dy);
      if (a.new_name != null) it.name = String(a.new_name); if (a.label != null) it.label = String(a.label);
      for (const k of ["cat", "border", "color"]) if (a[k] != null) it[k] = a[k];
      if (a.cat && !a.color && KB.CAT[a.cat]) it.color = KB.CAT[a.cat].c;
      if (a.sub != null) it.sub = !!a.sub; if (a.lv != null) it.lv = +a.lv; if (a.rot != null && it.t === "item") it.rot = ((+a.rot % 360) + 360) % 360; if (a.flip != null) it.flip = !!a.flip;
      const dx = it.x - was.x, dy = it.y - was.y;
      if ((dx || dy) && kids.length) for (const c of kids) { c.x = r3(c.x + dx); c.y = r3(c.y + dy); }
      let note = "";
      if (it.t === "room" && (a.w != null || a.h != null) && a.refurnish !== false && kids.some(c => c.t === "item")) {
        S.items = S.items.filter(i => !(kids.includes(i) && i.t === "item")); const f = KB.furnishRoom(S, it); S.items.push(...f); note = ", мебель переставлена";
      }
      return { msg: `«${it.t === "room" ? it.name : it.k}»: ${it.w}×${it.h} в (${it.x}; ${it.y})${kids.length && (dx || dy) ? `, перенесено вместе с содержимым (${kids.length})` : ""}${note}`, ids: [it.id] };
    },
    delete(S, a) {
      const it = findEl(S, a.id || a.name || a.ref); const kids = it.t === "room" && a.with_contents !== false ? KB.contents(S, it) : [];
      const gone = new Set([it, ...kids]); S.items = S.items.filter(i => !gone.has(i));
      return { msg: `Удалено «${it.t === "room" ? it.name : it.k}»${kids.length ? ` и ${kids.length} предметов внутри` : ""}` };
    },
    add_item(S, a) {
      const f = KB.FK[a.k]; if (!f) throw new Error(`Нет предмета «${a.k}» в каталоге. Список — list_catalog.`);
      let x = a.x, y = a.y, lv = a.lv || 0;
      const w = a.w != null ? num(a.w, "w") : f.w, h = a.h != null ? num(a.h, "h") : f.h, rot = ((+a.rot || 0) % 360 + 360) % 360;
      const aw = rot % 180 ? h : w, ah = rot % 180 ? w : h;
      if (a.room) { const r = findEl(S, a.room, "room"); lv = lvOf(r);
        if (x == null || y == null) { const sp = KB.findSpace(S, { w: aw, h: ah, lv, within: r.id, near: a.near || "back", margin: 0.1, limit: 1 })[0];
          if (!sp) throw new Error(`В «${r.name}» нет места для ${f.n} ${aw}×${ah} м.`); x = sp.x; y = sp.y; } }
      if (x == null || y == null) { const sp = KB.findSpace(S, { w: aw, h: ah, lv, near: a.near || "center", limit: 1 })[0]; if (!sp) throw new Error("Нет свободного места."); x = sp.x; y = sp.y; }
      const n = Math.max(1, Math.min(40, +a.count || 1)), ids = [], gap = a.gap != null ? +a.gap : 0.2, dir = a.dir === "y" ? "y" : "x";
      for (let i = 0; i < n; i++) { const it = { id: uid(), t: "item", lv, k: a.k, x: r3(num(x, "x") + (dir === "x" ? i * (aw + gap) : 0)), y: r3(num(y, "y") + (dir === "y" ? i * (ah + gap) : 0)), w, h, rot, flip: !!a.flip, label: a.label || "" };
        if (/^door|^slide|^auto|^win/.test(a.k)) { const d = f.d; if (d === "door") it.h = r3(it.w + 0.3); if (d === "door2") it.h = r3(it.w / 2 + 0.3); }
        S.items.push(it); ids.push(it.id); }
      return { msg: `Добавлено: ${f.n} ×${n} в (${r3(+x)}; ${r3(+y)})`, ids };
    },
    furnish(S, a) {
      const r = findEl(S, a.room || a.id || a.name, "room");
      if (a.replace !== false) { const drop = new Set(KB.contents(S, r).filter(i => i.t === "item" && (a.keep_doors === false || !isDoorK(i.k)))); S.items = S.items.filter(i => !drop.has(i)); }
      const hasDoor = KB.contents(S, r).some(i => i.t === "item" && isDoorK(i.k));
      const f = KB.furnishRoom(S, r, { door: !hasDoor, face: a.face, seats: a.seats }); S.items.push(...f);
      return { msg: `«${r.name}»: расставлено ${f.length} предметов, лицевая сторона ${f._face}${f._note ? `, ${f._note}` : ""}`, ids: f.map(i => i.id) };
    },
    clear(S, a) { const r = findEl(S, a.room || a.id || a.name, "room"); const drop = new Set(KB.contents(S, r).filter(i => i.t === "item" && (a.doors || !isDoorK(i.k))));
      S.items = S.items.filter(i => !drop.has(i)); return { msg: `«${r.name}»: убрано предметов ${drop.size}` }; },
    add_door(S, a) {
      const r = findEl(S, a.room || a.id || a.name, "room"); const side = a.side || KB.doorSide(S, r), w = +a.width || 0.9;
      const along = side === "n" || side === "s" ? r.w : r.h, off = a.offset != null ? +a.offset : Math.max(0.05, Math.min(0.3, along - w - 0.05));
      const d = a.type === "slide" ? slideDoor(r, side, off) : door(r, side, off, w, a.inward !== false, { label: a.label || "" });
      S.items.push(d); return { msg: `Дверь ${Math.round(w * 1000)} в «${r.name}», сторона ${side}`, ids: [d.id] };
    },
    add_wall(S, a) { const kind = a.kind || "part", TH = { ext: 0.3, block: 0.2, part: 0.1, glass: 0.1, vitrage: 0.15, rail: 0.05 };
      if (!TH[kind]) throw new Error("kind: ext|block|part|glass|vitrage|rail");
      const wl = { id: uid(), t: "wall", lv: a.lv || 0, kind, x1: num(a.x1, "x1"), y1: num(a.y1, "y1"), x2: num(a.x2, "x2"), y2: num(a.y2, "y2"), th: TH[kind] };
      S.items.push(wl); return { msg: `Стена ${kind} ${Math.hypot(wl.x2 - wl.x1, wl.y2 - wl.y1).toFixed(2)} м`, ids: [wl.id] }; },
    floor(S, a) { const r = findEl(S, a.room || a.id || a.name, "room"); r.color = a.color; return { msg: `Пол «${r.name}» → ${a.color}` }; },
    generate(S, a) { const g = KB.generateFor(a); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, g.project);
      return { msg: `Сгенерирован план «${S.name}» ${S.b.w}×${S.b.d}×${S.b.h} м${g.mezz ? " с антресолью" : ""}. ${g.warnings.length ? "Предупреждения: " + g.warnings.join(" ") : "Без предупреждений."}` }; },
  };
  // Генерация по пакету: размеры здания, если не заданы, подбираются по площади
  KB.generateFor = function (a) {
    const p = Object.assign({}, a);
    if (p.pkg) { p.pkg = String(p.pkg).toUpperCase(); if (!KB.PACKAGES[p.pkg]) throw new Error("Пакет: S, M или L");
      p.area = +p.area || KB.PACKAGES[p.pkg].A; const b = KB.suggestBuilding(p.pkg, p.area); for (const q of ["w", "d", "h"]) if (p[q] == null) p[q] = b[q]; }
    return KB.generate(p);
  };
  KB.OP_ALIASES = { move: "update", resize: "update", edit: "update", remove: "delete", furnish_room: "furnish", add_furniture: "add_item", set_building: "building", new_office: "generate", set_floor: "floor", clear_room: "clear" };
  KB.apply = function (S, op) {
    const name = KB.OP_ALIASES[op.op] || op.op, fn = KB.OPS[name];
    if (!fn) throw new Error(`Неизвестная команда «${op.op}». Есть: ${Object.keys(KB.OPS).join(", ")}.`);
    const r = fn(S, op) || {}; return Object.assign({ ok: true, op: name }, r);
  };
  // Пакет команд: выполняются по очереди; ошибка одной не отменяет остальные (если не atomic)
  KB.applyAll = function (S, ops, atomic) {
    const snap = atomic ? JSON.stringify(S) : null, res = [];
    for (const op of ops || []) { try { res.push(KB.apply(S, op)); } catch (e) { res.push({ ok: false, op: op.op, msg: e.message });
      if (atomic) { const back = JSON.parse(snap); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, back); res.push({ ok: false, msg: "Откат: пакет не применён целиком." }); break; } } }
    return res;
  };

  /* ---------- текстовое описание плана для Claude */
  KB.describe = function (S, o = {}) {
    const b = S.b, L = [], rooms = S.items.filter(i => i.t === "room");
    L.push(`Проект «${S.name}». Здание ${b.w}×${b.d} м (X вдоль дороги 0→${b.w}, Y вглубь 0→${b.d}; витраж/вход — сторона Y=${b.d}), высота ${b.h} м${b.mz ? `, отметка антресоли +${b.mz}` : ""}. Наружные стены 0,3 м.`);
    for (const lv of [0, 1]) {
      const rs = rooms.filter(r => lvOf(r) === lv).sort((a, c) => (a.y - c.y) || (a.x - c.x)); if (!rs.length) continue;
      const tot = rs.filter(r => !r.sub).reduce((s, r) => s + r.w * r.h, 0);
      L.push(`\n${lv ? (b.upper === "floor" ? "2 ЭТАЖ" : "АНТРЕСОЛЬ") : "1 ЭТАЖ"} — помещений ${rs.length}, сумма (без зон внутри) ${tot.toFixed(1)} м²:`);
      for (const r of rs) {
        const its = KB.contents(S, r).filter(i => i.t === "item"), cnt = {};
        for (const i of its) { const n = KB.FK[i.k] ? KB.FK[i.k].n : i.k; cnt[n] = (cnt[n] || 0) + 1; }
        L.push(`  [${r.id}] ${r.name}${r.sub ? " (зона)" : ""} — x ${r.x}, y ${r.y}, ${r.w}×${r.h} = ${(r.w * r.h).toFixed(1)} м², ${KB.CAT[r.cat] ? KB.CAT[r.cat].n : r.cat}, ${r.border === "none" ? "без стен" : r.border === "glass" ? "стекло" : "стены"}` +
          (o.items === false ? "" : its.length ? `; внутри: ${Object.entries(cnt).map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(", ")}` : "; пусто"));
      }
    }
    const free = S.items.filter(i => i.t === "item" && !rooms.some(r => lvOf(r) === lvOf(i) && !isHall(r) && inside(aabbOf(i), r, 0.35)));
    if (free.length && o.items !== false) { const cnt = {}; for (const i of free) { const n = KB.FK[i.k] ? KB.FK[i.k].n : i.k; cnt[n] = (cnt[n] || 0) + 1; }
      L.push(`\nПредметы в общем зале / вне помещений: ${Object.entries(cnt).map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(", ")}`); }
    const walls = S.items.filter(i => i.t === "wall"); if (walls.length) L.push(`Стен/перегородок отдельных: ${walls.length}`);
    if (o.ascii !== false) { L.push("\nСХЕМА 1 этажа (1 символ = 0,5 м; буквы — помещения из списка ниже, · — свободно, # — мебель):"); L.push(KB.ascii(S, 0)); }
    if (o.checks !== false) { L.push(""); L.push(KB.summary(S).split("\n").slice(1).join("\n")); }
    return L.join("\n");
  };
  KB.ascii = function (S, lv = 0, cell = 0.5) {
    const b = S.b, cols = Math.ceil(b.w / cell), rowsN = Math.ceil(b.d / cell), G = Array.from({ length: rowsN }, () => Array(cols).fill("·"));
    const rs = S.items.filter(i => i.t === "room" && lvOf(i) === lv).sort((a, c) => c.w * c.h - a.w * a.h);
    const sym = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", legend = [];
    rs.forEach((r, n) => { const s = sym[n % sym.length]; legend.push(`${s}=${r.name}`);
      for (let j = Math.floor(r.y / cell); j < Math.min(rowsN, Math.ceil((r.y + r.h) / cell)); j++) for (let i = Math.floor(r.x / cell); i < Math.min(cols, Math.ceil((r.x + r.w) / cell)); i++) if (j >= 0 && i >= 0) G[j][i] = s; });
    for (const it of S.items.filter(i => i.t === "item" && lvOf(i) === lv && !isDoorK(i.k))) { const a = aabbOf(it);
      for (let j = Math.floor((a.y + 0.1) / cell); j < Math.min(rowsN, Math.ceil((a.y + a.h - 0.1) / cell)); j++) for (let i = Math.floor((a.x + 0.1) / cell); i < Math.min(cols, Math.ceil((a.x + a.w - 0.1) / cell)); i++) if (j >= 0 && i >= 0) G[j][i] = "#"; }
    return G.map(r => r.join("")).join("\n") + `\n(низ схемы — фасад с витражом)\nЛегенда: ${legend.join(", ")}`;
  };
  KB.catalogText = function (group) {
    const g = {}; for (const f of KB.FURN) { if (group && !norm(f[2]).includes(norm(group))) continue; (g[f[2]] = g[f[2]] || []).push(`${f[0]} — ${f[1]} ${f[3]}×${f[4]} м`); }
    const rt = KB.ROOM_TYPES.map(t => `${t.key}: ${t.size.join("×")} м, ${KB.CAT[t.cat].n}, ${t.border === "none" ? "зона без стен" : t.border === "glass" ? "стекло" : "стены"}`);
    return Object.entries(g).map(([k, v]) => `${k}:\n  ${v.join("\n  ")}`).join("\n") + (group ? "" : `\n\nТипы помещений (распознаются по названию, задают мебель и размер по умолчанию):\n  ${rt.join("\n  ")}\nЦвета пола: ${KB.FLOORS.map(f => `${f[0]} ${f[1]}`).join("; ")}`);
  };
  KB.FLOORS = [["Керамогранит светлый", "#EDE8DE"], ["Керамогранит серый", "#C9C9C4"], ["Мрамор", "#F2F0EA"], ["Бетон / микроцемент", "#BDBAB2"], ["Ламинат дуб", "#D9B98E"], ["Паркет орех", "#A8784E"], ["Ковролин серый", "#9EA3A6"], ["Ковролин синий", "#5F7390"], ["Плитка санузла", "#CFE8E6"], ["Резиновое покрытие (детская)", "#F4D36B"], ["Тёмный керамогранит", "#5B5854"], ["Белый глянец", "#FAFAF7"]];

  /* ------------------------------------------------------------ описание для ИИ-помощника */
  KB.PARAM_SCHEMA_TEXT = `{"name":string,"w":число м (длина вдоль дороги),"d":число м (глубина),"h":число м (высота),"M":менеджеров на смене,"B":сотрудников бэк-офиса,"maket":"3x2"|"5x3"|"6x4","kids":bool,"cafe":bool,"wardrobe":bool,"bank":bool,"cashier":bool,"media":bool,"showroom":bool,"director":bool,"mezz":"auto"|"yes"|"no"}`;

  if (typeof module !== "undefined" && module.exports) module.exports = KB; else root.OfficeKB = KB;
})(typeof window !== "undefined" ? window : globalThis);
