# Манифест и раскладки плагина

[English](plugin-manifest.md) | Русский

Каждый плагин Antigravity строится вокруг плоского манифеста `plugin.json` и
стандартных директорий компонентов в корне плагина.

## Единый загрузчик для CLI, App и IDE

В Antigravity `1.5.17+` все три поверхности Google Antigravity используют один
общий Go-загрузчик и единую схему:

- **`agy` CLI (`1.5.17+`)** — ядро движка, `agy plugin validate` и демон `--hub`.
- **`Antigravity.app` (`2.35.1+`)** — встроенный Go language server с
  идентичными дескрипторами плагинов и хуков.
- **`Antigravity IDE` (`2.7.0+`)** — напрямую запускает `agy --hub`.

Нужно собирать, валидировать и поставлять только **один** формат плагина.

## Приоритет манифеста и корень компонентов

Antigravity ищет манифест плагина в трёх путях (от высшего приоритета к низшему):

1. `<plugin>/.antigravity-plugin/plugin.json` *(высший)*
2. `<plugin>/.gemini-plugin/plugin.json`
3. `<plugin>/plugin.json` *(корень — вариант по умолчанию в `create.mjs`)*

Два обязательных правила:

- **Не держите два манифеста** в одном плагине — затенённый манифест выдаёт
  warning и роняет `agy plugin validate --strict`.
- **Компоненты ВСЕГДА лежат в корне плагина** (`skills/`, `rules/`, `agents/`,
  `hooks.json`, `mcp_config.json`, `sidecars/`, `assets/`), даже если сам
  манифест находится в `.antigravity-plugin/plugin.json`.

Обе раскладки поддерживаются в `create.mjs`:

```bash
node scripts/create.mjs my-plugin                                 # корневой plugin.json
node scripts/create.mjs my-plugin --manifest-layout dot-antigravity
```

## Строгий JSON против JSONC

Хотя загрузчик в рантайме терпит комментарии JSONC и висячие запятые,
**`agy plugin install` требует строгий JSON**, а `agy plugin validate --strict`
падает на JSONC. Всегда коммитьте строгий JSON в `plugin.json` (и `hooks.json`).

## Допустимые поля `plugin.json`

```json
{
  "name": "my-plugin",
  "displayName": "My Plugin",
  "version": "1.0.0",
  "description": "One-sentence summary of what the plugin adds to Antigravity.",
  "logo": "assets/logo.svg",
  "suggestedPrompts": [
    "Review this repository with my-plugin",
    "Run /my-plugin-help"
  ],
  "author": {
    "name": "Your Name",
    "url": "https://github.com/your-org"
  },
  "homepage": "https://github.com/your-org/my-plugin",
  "repository": "https://github.com/your-org/my-plugin",
  "license": "MIT",
  "keywords": ["antigravity", "plugin"],
  "category": "Developer Tools"
}
```

| Поле | Формат и ограничения |
|---|---|
| `name` | Строгий нижний kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Глобально уникальное имя — при коллизии один плагин тихо отбрасывается. |
| `displayName` (`display_name`) | Заголовок в UI. Для Marketplace не начинайте название с `"Antigravity"`. |
| `version` | SemVer (`MAJOR.MINOR.PATCH`). Обязательно для публикации в Marketplace. |
| `description` | 1–2 предложения (~120–160 символов для карточек Marketplace). |
| `logo` | Относительный путь `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp` (квадрат `>=128×128`, ~10% прозрачных полей, **не** внутри папок с точкой вроде `.github/`), либо `https://` URL на домене Google. Без `logo` валидатор выдаст `note`. |
| `suggestedPrompts` (`suggested_prompts`) | До **3** непустых стартовых промптов (4+ или пустые строки дают warning). |
| `author` | Строка (`"Your Name"`) **или** `{ "name": "...", "email"?: "...", "url"?: "https://..." }`. |
| `homepage` | URL `https://`. |
| `repository` | Строка URL `https://` **или** `{ "type": "git", "url": "https://..." }`. |
| `license`, `keywords`, `category` | SPDX-строка, `string[]`, непустая строка категории. |
| `disabled` | Boolean (`true` — плагин ставится выключенным до явного включения). |
| `skills` | Опциональный путь или `string[]` дополнительных директорий скиллов. |
| `extensions` | Опционально `extensions["com.google.antigravity"].contextProviders`. |

## Мёртвые ключи, роняющие `--strict`

**Не** добавляйте устаревшие или сторонние поля — каждое выдаёт
`unknown field "<key>" is ignored` и валит `agy plugin validate --strict`:

- `interface` (заменено плоскими `displayName`, `logo`, `suggestedPrompts`)
- `rules`, `hooks`, `agents`, `commands`, `mcpServers`, `sidecars`
  (автоматически ищутся в корне плагина, а не объявляются в `plugin.json`)
- `variables` (живёт внутри отдельных серверов в `mcp_config.json`)
- `contextProviders`, `bundleMembers`

## Включение, приоритет поиска и JSON-реестры

Antigravity загружает кастомизации по строгому приоритету (от высшего к низшему):

1. **Воркспейс:** `.agents/` (и `.agent/`, `_agents/`, `_agent/`) вверх от CWD
   до корня репозитория — как `.agents/plugins/<name>/`, так и плоские
   `.agents/{skills,rules,agents,hooks.json,mcp_config.json}`. В неинтерактивном
   `agy -p` нужен флаг `--add-dir <project>`.
2. **Объявленные JSON-реестры воркспейса:** `.agents/{plugins,skills,rules,agents,sidecars}.json`
   (пути не могут выходить за корень репо через `../`, абсолютные пути или симлинки).
3. **Глобальный уровень:** `~/.gemini/config/plugins/<dir>/` (плюс
   `~/.gemini/config/{skills,rules,agents,hooks.json,mcp_config.json}` и
   `~/.agents/skills/`).
4. **Встроенные кастомизации** и **глобальные JSON-реестры**.

**Состояние включения (`installed_version.json` устарел):**
- Любая папка в `~/.gemini/config/plugins/<dir>/` с валидным `plugin.json`
  подхватывается автоматически без `installed_version.json`.
- Состояние вкл/выкл хранится в `~/.gemini/config/config.json` по ключу
  `plugins.<dir>.enabled` — именно по **имени папки установки** (не по `name` из
  `plugin.json`) и всегда перебивает `"disabled": true`.
- Глубокие ссылки в UI используют схему `customization://<dir>`.

## Сайдкары (`sidecars/`)

Плагин может запускать фоновые воркеры через `sidecars/<id>/sidecar.json` (или
корневой `sidecars.json`) с автоматическим именем `<plugin>/<id>`:

```json
{
  "command": "node",
  "args": ["worker.mjs"],
  "restart_policy": "on-failure",
  "display_name": "My Worker",
  "description": "Background helper process."
}
```

Каждый сайдкар обязан задать **либо `command`, либо `builtin`** (например
`"builtin": "schedule"`), никогда оба сразу, и валидную `restart_policy`
(`always` | `on-failure` | `never`). Готовый пример генерируется флагом
`create.mjs my-plugin --with-sidecar`.

Далее: [Субагенты](agents.ru.md) · [Правила и воркфлоу](rules-workflows.ru.md) · [Релиз](shipping.ru.md)
