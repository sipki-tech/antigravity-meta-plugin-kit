# Субагенты

[English](agents.md) | Русский

Субагенты позволяют плагину делегировать ограниченную профильную задачу (аудит,
проектирование хуков, исследование, верификацию) в отдельный контекст со своим
системным промптом, тиром модели, политикой shell и набором инструментов.

В Google Antigravity `1.5.17+` субагенты описываются **строго в Markdown** —
никогда не в TOML. Каждый контракт ниже проверен через `agy plugin validate
--strict` и живыми изолированными пробами `agy -p`.

## Расположение файлов и почему TOML мёртв

Antigravity загружает субагентов плагина из трёх мест в корне плагина:

- `agents/<name>.md` — однофайловое определение (рекомендуется для большинства
  субагентов).
- `agents/<name>/agent.md` — формат директории, если рядом с промптом лежат
  вспомогательные файлы или скрипты. Имя файла строго в нижнем регистре
  `agent.md` ради совместимости с Linux.
- `agents.json` — опциональный JSON-реестр (`{"entries": [{"path": "..."}]}`)
  для нестандартных относительных путей.

Два устаревших формата **не работают** в публичных плагинах:

- **`agents/*.toml` полностью мёртв:** `agy 1.5.17` тихо игнорирует `.toml`
  (`agents: 0`), а `agy plugin validate --strict` выдаёт **ноль предупреждений**.
  `lint.mjs` отмечает любой `agents/*.toml` как жёсткий `FAIL`.
- **`agents/<name>/agent.json` только для внутренних сборок Google:** валидатор
  предупреждает, что `agent.json` не загружается в публичных билдах.

## Канонический Markdown frontmatter

Каждый файл агента начинается с YAML frontmatter, а тело содержит системный
промпт:

```markdown
---
name: my-plugin-reviewer
description: >-
  Audits changed files for policy violations. Delegate when reviewing diffs
  or auditing plugin payloads; do not use for editing code.
subagent: true
mainAgent: false
model: inherit
inheritMcp: false
commandExecutionPolicy: off
tools:
  - read_file
---

# Role

You are a read-only policy reviewer. Inspect the files named in the prompt and
return concrete `file:line` findings. Never claim to have edited files.
```

Поддерживаемые поля frontmatter:

| Поле | Тип / значения | Поведение в `agy 1.5.17+` |
|---|---|---|
| `name` | строка kebab-case *(обязательно)* | Уникальное имя. Не может конфликтовать со встроенными (`self`, `browser`, `research`, `deepagent`, `review-agent`, `image-generator`). |
| `description` | строка *(обязательно, поддерживается `>-`)* | Описание маршрутизации для родительского агента. Укажите **когда делегировать** и **когда не делегировать**. |
| `subagent` | boolean (по умолчанию `true`) | Открывает агента для `invoke_subagent`. |
| `mainAgent` | boolean (по умолчанию `true`) | Ставьте `false` для чистых субагентов, чтобы они не засоряли `/agents` и `agy --agent`. |
| `model` | `inherit` \| `flash_lite` \| `flash` \| `pro` (или опустить) | Конкретные ID моделей (например `gemini-4-neon-high` или `auto`) дают **жёсткую ошибку** и полностью пропускают агента. |
| `commandExecutionPolicy` | `off` \| `auto` \| `eager` \| `sandbox` | Любое другое значение даёт **жёсткую ошибку** и пропускает агента. |
| `tools` | YAML `[]string` | Строка через запятую вызывает жёсткую ошибку. См. правила ниже. |
| `inheritMcp` | boolean (по умолчанию `true`) | Ставьте `false`, чтобы субагент не наследовал все пользовательские MCP-серверы и их схемы. |
| `mcpServers` | `[]object` | Опциональный список объектов MCP-серверов только для этого агента (строки и мапы дают ошибку). |
| `skills`, `preloadSkills`, `rules`, `hooks`, `plugins`, `agents` | списки YAML | Опциональная привязка компонентов плагина к конкретному агенту. |
| `inheritCustomizations` | boolean | Взаимоисключающе с `inheritScopes`. |
| `hidden`, `disabled`, `icon`, `logo` | метаданные | Опциональные метаданные UI; неизвестные ключи тихо игнорируются. |

## Выбор `model:` (живой маппинг тиров `agy 1.5.17`)

Antigravity принимает **только** четыре абстрактных тира (`inherit`,
`flash_lite`, `flash`, `pro`) либо отсутствие поля `model:`. Живые пробы на
`agy 1.5.17` (родительская сессия на `gemini-4-neon-xhigh`) показали точный
маппинг:

| Значение `model:` | Фактическая модель в рантайме | Когда использовать |
|---|---|---|
| `inherit` *(или опущено)* | **`gemini-4-neon-xhigh`** (точная модель родителя: Neon, Carbon, Argon или Claude) | **Значение по умолчанию для специалистов** (аудиторы, архитекторы, проектировщики хуков, ревьюеры). |
| `pro` | `gemini-4-hydrogen-tiered-xhigh` | Явный мощный тир Hydrogen, если вам *специально* не нужна модель родителя. |
| `flash` | `gemini-4-hydrogen-tiered-high` | Быстрые и дешёвые многошаговые задачи (разведка, саммари, парсинг логов). |
| `flash_lite` | `gemini-3.5-flash-lite` | Массовая классификация, простое извлечение и форматирование. |

> **Важная ловушка:** Не считайте, что `model: pro` выбирает Neon или Carbon.
> Если пользователь работает на флагманской модели, `model: pro` фактически
> переключит субагента на Hydrogen xhigh. Ставьте `model: inherit`, когда нужна
> полная мощность родительской сессии.

## Ограничение прав: `tools:`, `inheritMcp` и `commandExecutionPolicy`

Узкие права делают субагентов быстрее, дешевле (меньше схем инструментов в
контексте) и безопаснее:

1. **Всегда ставьте `inheritMcp: false`**, если субагенту не нужны MCP-серверы
   пользователя. Живые пробы подтвердили, что `inheritMcp: false` чисто убирает
   `call_mcp_tool` и все eager MCP-инструменты из промпта дочернего агента.
2. **Выбирайте минимальную `commandExecutionPolicy`:**
   - `off` — запрет shell-команд (в паре с `tools: [read_file]` идеально для
     ревьюеров и проектировщиков).
   - `sandbox` — песочница shell (подходит для разведки: `rg`, `probe.mjs`,
     `agy plugin validate`).
   - `auto` — обычные запросы разрешений, когда нужен shell.
   - `eager` — автоподтверждение безопасных команд (избегайте без веской причины).
3. **Всегда указывайте `tools:` явно** в виде YAML-массива. Без `tools:` выдаётся
   базовый read-only набор (`read_file`, `search_web`, `schedule`,
   `generate_image`, `manage_task`, `send_message`) плюс унаследованные MCP.

### Нативный реестр инструментов

В `agy 1.5.17` зарегистрированы только эти нативные имена инструментов:

- **Файлы и shell:** `read_file`, `edit_file`, `write_file`, `run_command`,
  `manage_task`
- **Веб и медиа:** `search_web`, `generate_image`
- **Агенты и воркфлоу:** `invoke_subagent`, `define_subagent`,
  `manage_subagents`, `send_message`, `ask_question`, `update_steps`,
  `schedule`, `run_workflow`, `swarm`
- **MCP:** `call_mcp_tool`, `list_resources`, `read_resource`

Служебные инструменты обмена сообщениями (`send_message`, `manage_task`) рантайм
подключает автоматически поверх вашего списка.

### Legacy-алиасы и тихие ловушки

`agy plugin validate --strict` **не проверяет имена инструментов** — это одна из
самых острых слепых зон, которую закрывает `lint.mjs`:

- **Любая опечатка или неизвестный инструмент** проходит `--strict`, но **роняет
  старт субагента в рантайме** ошибкой:
  `unknown component: tool "<name>" not found in registry`.
- **Устаревшие IDE-алиасы:** `view_file` тихо мапится на `read_file`,
  `replace_file_content` — на `edit_file`, **а `grep_search` тихо исчезает**,
  оставляя субагента с **нулём инструментов поиска**. Для поиска по коду
  выдавайте `run_command` с `commandExecutionPolicy: sandbox` (для `rg`/`grep`).

## Видимость: `subagent` против `mainAgent` и slash-команды

- Для внутренних специалистов, вызываемых через `invoke_subagent`, ставьте
  `subagent: true` и `mainAgent: false`.
- Ставьте `mainAgent: true` только если пользователь должен запускать агента
  напрямую через `agy --agent <name>` или выбирать в `/agents`.
- **Агенты никогда не становятся `/slash`-командами.** Чтобы дать пользователю
  детерминированную команду `/my-plugin-audit`, добавьте тонкий скилл-обёртку в
  `skills/my-plugin-audit/SKILL.md` с `disable-model-invocation: true`:

```markdown
---
name: my-plugin-audit
description: Run the read-only my-plugin-reviewer subagent on the current workspace.
disable-model-invocation: true
---

# /my-plugin-audit

Invoke the `my-plugin-reviewer` subagent via `invoke_subagent` with the user's
target path (or the current workspace root if omitted), then present its
`file:line` findings clearly without re-running the audit yourself.
```

## Дизайн промпта для надёжного делегирования

Субагент стартует с чистой историей — он видит **только** свой системный промпт
и задачу, переданную родителем в `invoke_subagent`. Стройте тело промпта вокруг
четырёх элементов:

1. **Чёткая роль и границы:** что именно субагент делает и чего не трогает.
2. **Конкретная процедура:** 3–5 нумерованных шагов, строго согласованных с
   `tools:` (не просите агента с `tools: [read_file]` запускать команды).
3. **Структурированный формат ответа:** например список `FAIL` / `WARN` / `PASS`
   со ссылками `file:line` или строгий JSON.
4. **Граница честности:** явно укажите сообщать об отсутствующих файлах и
   заблокированных проверках вместо догадок.

## Чеклист

- [ ] Файл сохранён как `agents/<name>.md` или `agents/<name>/agent.md` (ноль `.toml`).
- [ ] `name` не конфликтует со встроенными; `description` описывает когда
      делегировать и когда не делегировать.
- [ ] `model:` — один из `inherit`, `flash_lite`, `flash`, `pro` (без конкретных ID).
- [ ] `commandExecutionPolicy:` — один из `off`, `auto`, `eager`, `sandbox`.
- [ ] `tools:` — YAML-массив из нативного реестра (без `grep_search` и опечаток).
- [ ] Указано `inheritMcp: false`, если пользовательские MCP не нужны.
- [ ] Чистые субагенты имеют `mainAgent: false`; любая `/cmd`-точка входа сделана
      через скилл с `disable-model-invocation: true`.
- [ ] И `lint.mjs --strict`, и `agy plugin validate --strict --json` дают ноль замечаний.

Далее: [Хуки жизненного цикла](hooks.ru.md) · [Скиллы](skills.ru.md) · [Внутренности](../internals.md)
