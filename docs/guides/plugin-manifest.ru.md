# Манифест и раскладки: plugin.json, два мира, пути установки

*[English](plugin-manifest.md) | Русский*

## Два мира плагинов

Antigravity загружает плагины через две поверхности с разными ожиданиями:

1. **Мир IDE-менеджера плагинов** — `~/.gemini/config/plugins/<name>/`
   (зеркалируется в `~/.gemini/antigravity-cli/plugins/<name>/`, когда такая
   папка есть). Богатые манифесты, управляемые установки,
   `installed_version.json`.
2. **Мир CLI customization root** — `<project>/.agents/plugins/<name>/`
   (также `.agent/`, `_agents/`, `_agent/`) или глобально `~/.gemini/config/`.
   Официально плагину здесь нужен только `plugin.json` с необязательным
   `name` (по умолчанию — имя папки); компоненты лежат по фиксированным
   относительным путям.

Скаффолдный payload удовлетворяет обоим: несёт богатый манифест (мир 1 его
рендерит, мир 2 игнорирует лишние поля) и держит `hooks.json` в корне
плагина (официальное место мира 2; мир 1 находит его по пути из манифеста).

Мир 2 — это механизм *обнаружения*, а не команда установки: `agy plugin
install` только глобальный. Чтобы ограничить плагин одним проектом, положите
его под `.agents/` проекта и закоммитьте; `[OBSERVED 2026-07-12]`
подхватываются обе формы — обёрнутая `.agents/plugins/<name>/` и плоская
`.agents/skills/<name>/` (плюс `.agents/rules/`, `.agents/hooks.json`,
`.agents/mcp_config.json`). В неинтерактивном `-p` укажите воркспейс через
`--add-dir <project>`; интерактивная сессия использует директорию запуска.

## plugin.json — авторский профиль

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "Одна строка о том, что он делает.",
  "author": { "name": "you", "email": "optional@example.com" },
  "repository": "https://github.com/you/my-plugin",
  "license": "MIT",
  "keywords": ["antigravity", "plugin"],
  "skills": "./skills",
  "rules": "./rules",
  "hooks": "./hooks.json",
  "interface": {
    "displayName": "My Plugin",
    "shortDescription": "Показывается в менеджере плагинов.",
    "category": "Developer Tools",
    "capabilities": ["Skills", "Rules", "Hooks"],
    "defaultPrompt": ["my-plugin-example покажи, что умеешь"],
    "brandColor": "#5B8DEF"
  }
}
```

Заметки по полям:

- **`name`** — должно совпадать с именем директории payload (линт это
  проверяет).
- **`author`** — **обязательно объект**, никогда не голая строка; строка
  может молча сломать валидацию (наблюдение 2026-07).
- **`version`** — semver; IDE-менеджер плагинов копирует его в
  `installed_version.json` при установке (вы этот файл не пишете никогда).
- **`skills` / `rules` / `hooks`** — относительные пути; каждый объявленный
  путь должен существовать (линт: «declared paths exist»).
- **`interface`** — чистые UI-метаданные для менеджера плагинов; на runtime
  не влияет. Минимум — `displayName` + `shortDescription`.

## Ловушка `installed_version.json` — один файл, два мира

`installed_version.json` — **артефакт времени установки**, а не файл
payload — и два пути установки обходятся с ним по-разному:

- **IDE-менеджер плагинов** пишет `{"version": "<semver>"}` в каждую
  установленную папку плагина и по этому файлу распознаёт плагин как
  установленный. Голая ручная копия в `~/.gemini/config/plugins/` без него
  **молча игнорируется** этой поверхностью — ни ошибки, ни строки в логе.
- **CLI `agy plugin install`** version-файл **не пишет**. Он централизованно
  записывает установку в `~/.gemini/config/import_manifest.json`, и скиллы и
  хуки плагина всё равно загружаются (проба 2026-07-12).

Следствия:

- пусть файл пишет путь установки — IDE-менеджер плагинов делает это, а
  `agy plugin install` вместо этого регистрирует плагин; вы не пишете ни
  того, ни другого;
- никогда не коммитьте его в payload (скаффолдный `.gitignore` исключает;
  линт предупредит, если просочился);
- чтобы подтвердить установку, используйте `agy plugin list` и
  `agy plugin validate`, а не ручную проверку наличия файла.

## Раскладки установки

| Скоуп | Папка плагина | MCP-конфиг |
|---|---|---|
| Глобально | `~/.gemini/config/plugins/<name>/` | `~/.gemini/config/mcp_config.json` |
| Глобальное зеркало | `~/.gemini/antigravity-cli/plugins/<name>/` (только если `antigravity-cli/plugins/` существует) | — |
| Воркспейс | `<project>/.agents/plugins/<name>/` | `<project>/.agents/mcp_config.json` |

Воркфлоу идут в `<project>/.agents/workflows/` (зеркало в
`.agent/workflows/` — только если `.agent/` уже существует).

## Приоритет загрузки

От высокого к низкому: обнаружение в воркспейсе → объявленные конфиги
воркспейса (`skills.json`/`plugins.json`) → глобальное
(`~/.gemini/config/`) → встроенные → глобально объявленные. Конфликты имён
решаются в пользу более высокого приоритета.

## Файлы-реестры (`skills.json` / `plugins.json`)

Чтобы грузить кастомизации из нестандартных мест (например, общая командная
папка, закоммиченная в репозиторий):

```json
{
  "entries":  [ { "path": "tools/agents/skills" } ],
  "inherits": [ { "path": "/shared/skills.json", "exclude": ["deprecated-.*"] } ]
}
```

Пути: `/абсолютные`, `~/от-домашней`, иначе — относительно воркспейса.

## Подводные камни

- Строковый `author` → тихий провал валидации.
- Ручная копия папки в IDE-мире без `installed_version.json` → молча
  игнорируется; ставьте через `agy plugin install`.
- `hooks` в манифесте, указывающий на `hooks/hooks.json` → работает в
  IDE-мире, но невидим для `agy plugin validate`; держите файл в корне.
- Переименование папки payload без обновления `name` → падает «name matches
  directory», а в мире 2 меняется авто-имя.

## Чеклист

- [ ] `author` — объект; `version` — semver
- [ ] все объявленные пути существуют; `hooks` указывает на корневой `hooks.json`
- [ ] `installed_version.json` никогда не закоммичен в payload (его пишет путь
      установки, либо `agy plugin install` регистрирует вместо него)
- [ ] `lint` и `agy plugin validate` оба зелёные

*См. также: [Быстрый старт](getting-started.ru.md) ·
[Хуки](hooks.ru.md) · [реестр ловушек](../internals.md)*
