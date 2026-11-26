# Правила и воркфлоу

[English](rules-workflows.md) | Русский

Правила добавляют постоянные или условные инструкции в контекст агента.
Markdown-файлы `workflows/*.md`, напротив, **не загружаются из плагинов** в
`agy 1.5.17+` и должны быть заменены slash-скиллами.

## Где живут правила

Внутри плагина Antigravity сканирует **только** два источника:

- `rules/` — плоское сканирование на 1 уровень (`rules/*.md`).
- `rules.json` — опциональный JSON-реестр в корне плагина
  (`{"entries": [{"path": "..."}]}`).

**Не** кладите `AGENTS.md` или `GEMINI.md` в корень плагина — `agy plugin
validate --strict` предупреждает, что корневые файлы инструкций в плагинах не
загружаются (корневой `AGENTS.md` — это соглашение *воркспейса*, а не плагина).

## Простые always-on правила: `rules/AGENTS.md` и `rules/GEMINI.md`

Официальный способ Google положить одно always-on правило в плагин — точное
заглавное имя **`rules/AGENTS.md`** или **`rules/GEMINI.md`** **без YAML
frontmatter**:

```markdown
# Project conventions

- Keep changes minimal and covered by `node:test`.
- Never log secrets or API tokens to stdout.
```

> **Ловушка регистра:** строчные `rules/agents.md` или `rules/gemini.md` без
> frontmatter вызывают **жёсткую ошибку** — от обязательного `trigger:`
> освобождены только строго заглавные `AGENTS.md` и `GEMINI.md` (`rules/README.md`
> без frontmatter просто пропускается).

## Правила с триггерами (`rules/<name>.md`)

Любой другой `.md` в `rules/` **обязан** объявить валидный `trigger:` в YAML
frontmatter, иначе Antigravity отклонит файл с жёсткой ошибкой (`rules: 0`):

| `trigger` | Обязательное доп. поле | Когда Antigravity подмешивает правило |
|---|---|---|
| `always_on` | *(нет)* | Каждый ход в каждом воркспейсе, где плагин включён. |
| `model_decision` | `description` | Только когда модель решает, что задача совпадает с `description`. **Рекомендуется для профильных плагинов** (0 токенов в чужих проектах). |
| `glob` | `globs` (или `glob`) | Только при работе агента с файлами, совпадающими с шаблоном. |
| `manual` | *(нет)* | Только при явном `@`-упоминании в Antigravity App. |

Пример точечного правила (`trigger: model_decision`):

```markdown
---
trigger: model_decision
description: Apply when authoring or auditing Google Antigravity plugins.
---

# Plugin authoring standards

- Author subagents in Markdown (`agents/*.md`), never TOML.
- Run `lint.mjs --strict` and `agy plugin validate --strict --json` before shipping.
```

### Ловушки синтаксиса `globs`

С `trigger: glob` связаны две частые ошибки:

1. **`globs` должен быть одной строкой через запятую — никогда не YAML-массивом.**
   Запись:
   ```yaml
   globs:
     - "**/*.ts"
     - "**/*.tsx"
   ```
   падает с жёсткой ошибкой `cannot unmarshal !!seq into string`.
2. **Не используйте фигурные скобки вроде `**/*.{ts,tsx}`.** Antigravity режет
   `globs` по запятым *до* передачи в `doublestar/v4`, превращая `{ts,tsx}` в
   два сломанных обрывка (`**/*.{ts` и `tsx}`). `agy plugin validate` этого не
   ловит, а `lint.mjs` выдаёт warning. Всегда раскрывайте явно:
   ```yaml
   ---
   trigger: glob
   globs: "**/*.ts, **/*.tsx"
   ---
   ```

## Лимиты размера и бюджет токенов

Antigravity применяет два жёстких бюджета к правилам:

- **24 000 байт на один файл правила** (измеряется *после* раскрытия включений
  `@[label](path)`). Более крупные файлы дают warning и обрезаются.
- **20 000 токенов (`defaultRulesBudget`)** суммарно на все always-on правила в
  сессии. При превышении правила тихо деградируют до указателей на путь файла
  вместо полного текста.

Держите always-on правила компактными — до **~100–150 строк**. Подробные
таблицы, чеклисты и инструкции выносите в [Скиллы](skills.ru.md)
(`skills/<name>/SKILL.md`) или файлы в `references/`, загружаемые по запросу.

## Почему `workflows/*.md` в плагинах мертвы (и чем их заменить)

В `agy 1.5.17+` каталоги `workflows/*.md` и `commands/` внутри плагина **никогда
не загружаются** (`agy plugin validate --strict` падает с сообщением `plugins
don't load Markdown workflows`).

### Миграция slash-команд в скиллы

Перенесите каждый старый `workflows/<cmd>.md` в slash-скилл по пути
`skills/<cmd>/SKILL.md` с `disable-model-invocation: true`:

```markdown
---
name: my-plugin-release
description: Run the release checklist and verify the plugin before tagging.
disable-model-invocation: true
---

# /my-plugin-release

1. Run `npm test`.
2. Run `agy plugin validate --strict --json plugins/my-plugin`.
3. Report any findings before creating a git tag.
```

Пользователь вызывает его через `/my-plugin-release`, а флаг
`disable-model-invocation: true` запрещает модели активировать его случайно в
нерелевантных задачах.

### Оркестрация агентов через `run_workflow`

Под «воркфлоу» в `agy 1.5.17` понимаются **динамические Python-скрипты
оркестрации**, запускаемые встроенным инструментом `run_workflow` (параллельный
веер субагентов, конвейеры и агрегация). Если плагин автоматизирует
мультиагентные пайплайны, опишите их в скилле и храните скрипты внутри
`skills/<name>/scripts/`, не создавая корневую папку `workflows/`.

Далее: [Скиллы](skills.ru.md) · [Манифест и раскладки](plugin-manifest.ru.md) · [Внутренности](../internals.md)
