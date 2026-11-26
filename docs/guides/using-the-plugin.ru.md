# Работа с плагином

[English](using-the-plugin.md) | Русский

После установки через `agy plugin install https://github.com/sipki-tech/antigravity-meta-plugin-kit`
кит помогает агенту Antigravity напрямую при проектировании, аудите,
тестировании, диагностике и релизе плагинов.

## Ноль шума вне проектов плагинов

`antigravity-meta-plugin-kit` `v0.6.0` полностью ненавязчив:

- **Ноль глобальных хуков** — ничего не запускается на `PreToolUse`,
  `PostToolUse` или `Stop` в чужих репозиториях.
- **Ноль always-on правил** — единственное правило (`rules/plugin-authoring.md`)
  имеет `trigger: model_decision`, поэтому обычные проекты не затрагиваются.
- **Изолированные субагенты** — все три объявляют `inheritMcp: false`,
  `mainAgent: false` и минимальные списки `tools:`.

## Готовые промпты для Antigravity

Копируйте и адаптируйте прямо в Antigravity CLI, App или IDE:

| Задача | Что написать в Antigravity | Что сработает |
|---|---|---|
| Создать новый CLI + `auth.json` плагин | *«Сгенерируй плагин `acme-billing` по паттерну minimal CLI + `auth.json`.»* | `meta-scaffold` |
| Спроектировать субагента | *«Создай read-only субагента-ревьюера SQL-миграций в `agents/` с `model: inherit` и slash-обёрткой `/sql-review`.»* | `meta-agents` |
| Написать безопасный хук | *«Сделай fail-open `PreToolUse` хук против `git push --force` с wire-тестами на `node:test`.»* | `meta-hooks` + `meta-hook-smith` |
| Полный механический + семантический аудит | `/meta-audit plugins/acme-billing` | `/meta-audit` + `meta-payload-auditor` |
| Проверить локальную среду `~/.gemini/config/` | `/meta-doctor` | `/meta-doctor` (`doctor.mjs`) |
| Проверить дрейф после обновления `agy` | `/meta-scout` | `/meta-scout` + `meta-trap-scout` |

## Восемь экспертных скиллов

Скиллы подключаются автоматически по теме вопроса либо явно через
`/<skill-name>`:

| Скилл | Когда использовать |
|---|---|
| `meta-scaffold` | Создать новый репозиторий плагина с нужными флагами `meta-kit create` и раскладкой |
| `meta-agents` | Описать или починить `agents/*.md` / `agents/*/agent.md`, тиры `model:`, `tools:`, `inheritMcp` или `/cmd`-обёртки |
| `meta-hooks` | Спроектировать `hooks.json` и fail-open скрипты на `io.mjs` под любое из 6 событий |
| `meta-skills` | Написать `SKILL.md` с сильными триггерами, многострочным YAML и объёмом до 24 КБ |
| `meta-rules` | Написать `rules/AGENTS.md` или правила с триггерами, обойти ловушки `globs`, мигрировать мёртвые `workflows/*.md` |
| `meta-mcp` | Настроить Stdio или Streamable HTTP `mcp_config.json`, `variables[]`, `eager`, `background`, MCP Apps или CLI + `auth.json` |
| `meta-test` | Построить wire-тесты хуков на `node:test`, тесты манифеста и изолированные пробы `agy -p` |
| `meta-ship` | Пройти `meta-kit lint --strict`, `agy plugin validate --strict --json`, `marketplace.json` и чеклист Marketplace |

## Slash-команды: `/meta-audit`, `/meta-doctor` и `/meta-scout`

Три тонких slash-скилла (`disable-model-invocation: true`) дают
детерминированные точки входа и никогда не срабатывают случайно:

- **`/meta-audit`** — запускает `meta-kit lint --strict` и `agy plugin validate
  --strict --json`, собирает дерево файлов плагина и делегирует семантический
  аудит read-only субагенту `meta-payload-auditor`.
- **`/meta-doctor`** — запускает read-only `meta-kit doctor` по
  `~/.gemini/config/` и `.agents/`, выявляя коллизии имён плагинов/скиллов/агентов,
  расхождения статуса включения, runtime-ловушки и жёсткие лимиты 24 КБ / 20k правил.
- **`/meta-scout`** — запускает `meta-kit probe --fast` (или `--live` по запросу)
  и делегирует поиск дрейфа субагенту `meta-trap-scout` в песочнице после
  обновления Antigravity.

## Три изолированных субагента

Все три запускаются с `model: inherit` (сохраняя вашу родительскую модель
Neon/Carbon/Argon или Claude) и `inheritMcp: false`:

| Субагент | Политика и tools | Роль |
|---|---|---|
| `meta-payload-auditor` | `off` · `[read_file]` | Семантический аудит за пределами статики: коллизии триггеров, права субагентов, крайние случаи хуков, раздутые always-on правила, связность манифеста. |
| `meta-hook-smith` | `off` · `[read_file]` | Проектирует полный fail-open комплект хука (фрагмент `hooks.json`, обработчик на `io.mjs`, юнит- и e2e-тесты `node:test`) без преждевременных правок файлов. |
| `meta-trap-scout` | `sandbox` · `[read_file, run_command, search_web]` | Исследует дрейф версий Antigravity через `probe.mjs`, встроенные доки и проверку бинарников. |

Флаг `mainAgent: false` скрывает их из меню `/agents` — они вызываются через
`invoke_subagent` (либо командами `/meta-audit` и `/meta-scout`).

## Рекомендуемый рабочий процесс

1. **Генерация:** попросите Antigravity *«Сгенерируй плагин `acme-lint` с
   субагентом и slash-командой»* (подхватится `meta-scaffold`).
2. **Добавление компонентов:** ставьте конкретные задачи по субагентам, хукам,
   правилам или MCP — нужный `meta-*` скилл загрузит точные контракты `1.5.17+`.
3. **Аудит перед PR:** вызовите `/meta-audit plugins/acme-lint`, чтобы
   совместить `meta-kit lint --strict`, `agy plugin validate --strict --json` и
   независимое ревью от `meta-payload-auditor`.
4. **Диагностика установки:** запускайте `/meta-doctor`, если что-то неожиданно
   затеняется или не загружается.
5. **Контроль обновлений:** после апдейта `agy` запустите `/meta-scout`, чтобы
   проверить, не изменились ли контракты рантайма.

Далее: [Быстрый старт](getting-started.ru.md) · [Тестирование](testing.ru.md) · [Исследование Antigravity](researching-antigravity.ru.md)
