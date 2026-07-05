# antigravity-meta-plugin-kit — тулкит разработки плагинов Google Antigravity

**Генерируйте, проверяйте и выпускайте плагины
[Google Antigravity](https://antigravity.google), не открывая заново
недокументированные ловушки загрузчика.** Zero-dependency тулкит на Node.js:
генератор плагинов, линтер со знанием ловушек, набор портируемых Agent Skills
и двуязычные гайды по каждой части системы кастомизации Antigravity —
плагины, скиллы (SKILL.md), хуки (hooks.json), правила, воркфлоу, сабагенты и
MCP-серверы.

[![CI](https://github.com/sipki-tech/antigravity-meta-plugin-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sipki-tech/antigravity-meta-plugin-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-success)

[English](README.md) | Русский

---

- [Зачем это существует](#зачем-это-существует)
- [Быстрый старт](#быстрый-старт)
- [Установка как плагина](#установка-как-плагина)
- [Что генерирует `create`](#что-генерирует-create)
- [Проверки линтера](#проверки-линтера)
- [Гайды](#гайды)
- [Скиллы](#скиллы)
- [Реестр ловушек](#реестр-ловушек)
- [Отношение к `agy plugin validate`](#отношение-к-agy-plugin-validate)
- [Отношение к antigravity-kit](#отношение-к-antigravity-kit)
- [FAQ](#faq)
- [Разработка](#разработка)
- [Лицензия](#лицензия)

## Зачем это существует

У загрузчика плагинов Antigravity есть **тихие** режимы отказа: плагин без
`installed_version.json` игнорируется без единого слова; строковый `author`
ломает валидацию; хук, бросивший исключение, ломает всю сессию пользователя;
скилл, в описании которого нет триггер-фразы, просто никогда не срабатывает.
Часть контрактов задокументирована только во встроенных доках внутри
CLI-бинарника; часть существует лишь как полевые наблюдения.

Этот кит превращает это знание в исполняемую форму:

- **`create`** — генерирует репозиторий плагина, корректный по построению:
  манифест, корневой `hooks.json` с fail-open-гардом, SKILL.md, который
  срабатывает, инсталлер с dry-run, тесты, зелёные из коробки, CI.
- **`lint`** — проверяет любой payload против каждой известной ловушки:
  именованные чеки и предупреждения.
- **Скиллы + гайды** — учат AI-агента (или человека) всей системе, с
  провенансом каждого утверждения ([docs/internals.md](docs/internals.md)).

## Быстрый старт

```bash
# создать новый репозиторий плагина в ./my-plugin/
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin

# предпросмотр без записи на диск
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --dry-run

# также сгенерировать пример сабагента (agents/*.toml — недокументированный формат)
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --with-agents

# проверить существующий плагин (payload или корень скаффолд-репозитория)
npx github:sipki-tech/antigravity-meta-plugin-kit lint my-plugin

# обойти кэш npx и взять последний коммит
npx github:sipki-tech/antigravity-meta-plugin-kit#main create my-plugin
```

Затем внутри скаффолда:

```bash
cd my-plugin
npm test                                   # зелёные из коробки
node bin/cli.mjs install --workspace       # установка в ./.agents/
node bin/cli.mjs verify --workspace        # именованные health-чеки
agy plugin validate plugins/my-plugin      # официальный структурный валидатор
```

## Установка как плагина

Мета-кит сам является Antigravity-плагином. Установка приносит пять
meta-скиллов, четырёх авторских сабагентов и slash-команды `/meta-*` прямо в
ваши сессии:

```bash
# глобально — все воркспейсы (после — перезапустите Antigravity)
npx github:sipki-tech/antigravity-meta-plugin-kit install

# в проект (коммитится)
npx github:sipki-tech/antigravity-meta-plugin-kit install --workspace

# добавить /meta-* slash-команды в текущий проект (после глобальной установки)
npx github:sipki-tech/antigravity-meta-plugin-kit workflows

# health-чек / обновление / удаление
npx github:sipki-tech/antigravity-meta-plugin-kit verify
npx github:sipki-tech/antigravity-meta-plugin-kit#main update
npx github:sipki-tech/antigravity-meta-plugin-kit uninstall
```

Сабагенты в комплекте (форматы: 3× TOML, 1× markdown — валидируются оба):

| Сабагент | Права | Работа |
|---|---|---|
| `meta-payload-auditor` | только чтение | семантический аудит payload за пределами механического линта: качество триггеров, логика хук-скриптов, связность манифеста |
| `meta-hook-smith` | только чтение | конструирует хуки: выбирает событие, отдаёт блок hooks.json, fail-open скрипт и тесты |
| `meta-trap-scout` | терминал (read-effect) | находит дрейф между установленным Antigravity и задокументированными контрактами |
| `meta-doc-mirror` | пишет только `*.ru.md` | держит двуязычные доки в синхроне, секция к секции |

Workflow-обёртки дают им детерминированные входы: `/meta-audit`,
`/meta-hook`, `/meta-scout`, `/meta-mirror` (агенты не становятся
slash-командами сами — см. [гайд по сабагентам](docs/guides/agents.ru.md)).

## Что генерирует `create`

```
my-plugin/
├── plugins/my-plugin/          # payload плагина
│   ├── plugin.json             # author-объект, блок interface, все поля
│   ├── hooks.json              # в КОРНЕ (официальное место); именованные хуки;
│   │                           # пример fail-open PreToolUse-гарда
│   ├── scripts/example-guard.mjs + scripts/lib/io.mjs  # fail-open обёртка runHook(),
│   │                           # официальный decision-диалект (+legacy-совместимость)
│   ├── skills/my-plugin-example/SKILL.md   # frontmatter + триггер-фраза
│   │   └── resources/prompt-template.md    # XML-структурированный промпт-шаблон
│   ├── agents/                 # только с --with-agents (пример сабагента)
│   ├── rules/style.md
│   └── mcp_config.json
├── installer/                  # журнал/dry-run, определение layout,
│                               # installed_version.json, неразрушающий MCP-merge
├── bin/cli.mjs                 # install | verify | uninstall, --workspace, --dry-run
├── test/                       # unit + e2e (node --test), зелёные из коробки
└── .github/workflows/ci.yml
```

## Проверки линтера

Exit 1 при любом FAIL; warnings и notes на код выхода не влияют.

| Проверка | Какую ловушку закрывает |
|---|---|
| plugin.json существует / парсится / имя совпадает с папкой | целостность манифеста |
| author — объект | строковый author ломает валидацию |
| version — semver, interface объявлен | отображение в менеджере плагинов |
| объявленные пути существуют (skills/rules/hooks) | битые ссылки манифеста |
| у каждого скилла есть SKILL.md; frontmatter валиден | скиллы, которые не загружаются |
| в описании скилла есть триггер | скиллы, которые не срабатывают |
| hooks.json парсится / объявляет именованные хуки | имя события на верхнем уровне (конфиг в стиле Claude Code не загрузится) |
| записи хуков корректны (5 событий, обе формы, type=command) | сломанные обработчики |
| таймауты хуков корректны | нечисловые/отрицательные таймауты |
| скрипты хуков существуют / fail-open | хуки, ломающие сессию |
| agents/*.toml минимально валидны | сломанные определения сабагентов |
| mcp: не-встроенные команды идут с disabled | отсутствующий бинарник ломает сессии |
| у workflows есть description во frontmatter | битые /slash-команды |
| rules непусты | мёртвая ссылка манифеста |

Warnings (на код выхода не влияют): hooks.json не в корне плагина
(`agy plugin validate` его не увидит), продублированный hooks.json с
расхождением, отсутствующий/завышенный таймаут (официальный default — 30с
блокировки), неизвестные события (`SessionStart` получает пометку
«опровергнуто»), стиль имени скилла, закоммиченный `installed_version.json`.

Проверка fail-open — эвристика (обёртка `runHook(` или try/catch вокруг
тела): она ловит типичный промах, а не любой небезопасный скрипт. Ловушка
`installed_version.json` выводится как warning/note, потому что это артефакт
времени установки, а не файл payload.

## Гайды

Подробные разборы каждого блока системы кастомизации Antigravity, каждый на
английском и русском:

| Гайд | Что покрывает |
|---|---|
| [Getting started](docs/guides/getting-started.md) · [RU](docs/guides/getting-started.ru.md) | scaffold → lint → test → install → verify, от и до |
| [Манифест и раскладки](docs/guides/plugin-manifest.md) · [RU](docs/guides/plugin-manifest.ru.md) | поля plugin.json, два мира плагинов, installed_version.json, пути установки |
| [Хуки](docs/guides/hooks.md) · [RU](docs/guides/hooks.ru.md) | все пять событий, официальные wire-контракты, закон fail-open, матчеры, таймауты |
| [Скиллы](docs/guides/skills.md) · [RU](docs/guides/skills.ru.md) | анатомия SKILL.md, триггер-фразы, progressive disclosure, XML-шаблоны промптов |
| [Сабагенты](docs/guides/agents.md) · [RU](docs/guides/agents.ru.md) | формат agents/*.toml, модели, промпты, валидация |
| [Правила и воркфлоу](docs/guides/rules-workflows.md) · [RU](docs/guides/rules-workflows.ru.md) | иерархия GEMINI.md/AGENTS.md, триггеры правил, workflow-slash-команды |
| [MCP-серверы](docs/guides/mcp.md) · [RU](docs/guides/mcp.ru.md) | mcp_config.json, транспорты stdio/SSE, конвенция disabled:true, merge/prune |
| [Тестирование](docs/guides/testing.md) · [RU](docs/guides/testing.ru.md) | zero-dep доктрина node --test, e2e хуков, dry-run-ассерты |
| [Релиз](docs/guides/shipping.md) · [RU](docs/guides/shipping.ru.md) | дистрибуция npx github:, паттерн update, маркетплейсы, CI-гейты, версии |

## Скиллы

Пять портируемых Agent Skills в
[plugins/antigravity-meta-plugin-kit/skills/](plugins/antigravity-meta-plugin-kit/skills/):
`meta-scaffold`, `meta-hooks`, `meta-skills`, `meta-test`, `meta-ship`.
[Установка плагина](#установка-как-плагина) доставляет их в Antigravity; для
других хостов скопируйте папку скилла в `~/.claude/skills/` (Claude Code)
или `~/.codex/skills/` (Codex).

## Реестр ловушек

[docs/internals.md](docs/internals.md) — канонический реестр всех ловушек
загрузчика, wire-форматов хуков и конвенций компонентов; каждое утверждение
помечено `[OFFICIAL 2026-07]`, `[OBSERVED 2026-07]` или `[MEDIUM]`, плюс
раздел «Опровергнутые слухи» (нет, `SessionStart` не существует). Линтер его
реализует; скиллы и гайды на него ссылаются.

## Отношение к `agy plugin validate`

У Antigravity есть собственный структурный валидатор. Запускайте **оба**:

| | `agy plugin validate` | `lint` этого кита |
|---|---|---|
| структура skills / agents / commands / mcpServers | ✔ | частично |
| наличие корневого hooks.json | ✔ | ✔ (+ содержимое, таймауты, fail-open) |
| стиль манифеста (author-объект, interface, semver) | — | ✔ |
| rules/ и workflows/ | — | ✔ |
| триггер-фразы, стиль скиллов | — | ✔ |
| ловушка installed_version.json | — | ✔ (warn/note) |

## Отношение к antigravity-kit

[antigravity-kit](https://github.com/sipki-tech/antigravity-kit) — эталонная
реализация, из которой извлечён каждый паттерн этого кита, и первый
потребитель линтера: CI клонирует его и линтует его payload на каждом пуше
(dogfood-гейт).

## FAQ

**Это работает с Antigravity IDE, с CLI (`agy`) или с обоими?**
С обоими. Скаффолд нацелен на богатый профиль IDE-менеджера плагинов и
совместим с миром CLI customization root (корневой `hooks.json`, минимальные
требования к манифесту). См. [гайд по манифесту](docs/guides/plugin-manifest.ru.md).

**Почему ноль зависимостей?** Кит запускается через `npx github:` на чужих
машинах; каждая зависимость — это поверхность атаки и время установки.
Встроенных модулей Node ≥18 достаточно.

**Почему плагин установился, но не загружается?** Почти наверняка ловушка
`installed_version.json` — см.
[гайд по манифесту](docs/guides/plugin-manifest.ru.md).

**Можно ли писать хуки не на Node?** Да — любой исполняемый файл (запуск
через `sh -c`). Закон fail-open действует всё равно: exit 0 и валидный JSON
на каждом пути. Скаффолдный `io.mjs` просто делает это удобным в Node.

## Разработка

```bash
npm test          # node --test; включает dogfood-набор, когда рядом есть
                  # ../antigravity-kit (или задан AGY_KIT_PAYLOAD),
                  # и agy-validate-набор, когда `agy` есть на PATH
```

Ноль runtime-зависимостей (только встроенные модули Node ≥18). См.
[CONTRIBUTING.md](CONTRIBUTING.md).

## Лицензия

MIT
