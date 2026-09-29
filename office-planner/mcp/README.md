# Планировщик офиса продаж — Claude как архитектор (MCP)

Как Blender MCP, только для планировок: вы пишете Claude, что нужно, — он сам ставит помещения,
мебель и двери по логике офиса продаж, проверяет нормы и смотрит на картинку плана.
Всё видно вживую в браузере: http://localhost:8765 (ваши правки мышкой Claude тоже видит).

## Установка (один раз)

**Вариант А — Claude Desktop, без Node:** скачайте `office-planner.mcpb` и откройте двойным щелчком
(или Настройки → Extensions → Install extension). Готово.

**Вариант Б — Claude Desktop, вручную:** нужен Node.js 18+ (https://nodejs.org).
Распакуйте `office-planner-mcp.zip`, например в `C:\Users\Вы\Documents\office-planner-mcp`.
Claude Desktop → Settings → Developer → Edit Config → в `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "office-planner": {
      "command": "node",
      "args": ["C:\\Users\\Вы\\Documents\\office-planner-mcp\\server.js"]
    }
  }
}
```
(на Mac: `"/Users/вы/Documents/office-planner-mcp/server.js"`). Перезапустите Claude Desktop.

**Вариант В — Claude Code:**
```
claude mcp add office-planner -- node /путь/к/office-planner-mcp/server.js
```

## Как работать

Напишите Claude, например:
- «Открой планировщик и собери офис продаж пакета M на 280 м²»
- «Добавь вторую переговорную на 8 человек рядом с VIP и расставь мебель»
- «Детскую перенеси подальше от входа, кофе-поинт — к витражу»
- «Проверь план и исправь замечания»
- «Сохрани проект как ЖК Север.json»

Claude откроет http://localhost:8765 — там план обновляется сразу. Сайт на GitHub Pages тоже можно
подключить: кнопка «Claude» → «Подключить» (Chrome/Edge; Safari — только localhost).

Проекты: `~/OfficePlanner` (Windows: `C:\Users\Вы\OfficePlanner`), текущий — `current.json`.
Настройки через переменные окружения: `OFFICE_PLANNER_PORT` (8765), `OFFICE_PLANNER_DIR`.

## Инструменты Claude
open_planner, describe_plan, view_plan (PNG 2D/3D из браузера), package_program, new_office, blank_building,
add_room, update_element, delete_element, add_furniture, furnish_room, clear_room, add_door, add_wall,
set_building, set_floor, batch, find_free_space, check_plan, list_catalog, planning_guide, undo, redo,
save_project, open_project.
