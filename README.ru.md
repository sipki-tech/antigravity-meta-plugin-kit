```
███╗   ███╗███████╗████████╗ █████╗       ██╗  ██╗██╗████████╗
████╗ ████║██╔════╝╚══██╔══╝██╔══██╗      ██║ ██╔╝██║╚══██╔══╝
██╔████╔██║█████╗     ██║   ███████║█████╗█████╔╝ ██║   ██║
██║╚██╔╝██║██╔══╝     ██║   ██╔══██║╚════╝██╔═██╗ ██║   ██║
██║ ╚═╝ ██║███████╗   ██║   ██║  ██║      ██║  ██╗██║   ██║
╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝      ╚═╝  ╚═╝╚═╝   ╚═╝
```

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
- [Установка как плагина](#установка-как-плагина)
- [Быстрый старт](#быстрый-старт)
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

- **`create`** — генерирует native-only репозиторий плагина, корректный по
  построению: манифест, корневой `hooks.json` с fail-open-гардом, SKILL.md,
  который срабатывает, тесты, зелёные из коробки, CI. Без встроенного
  инсталлера — результат ставится через `agy plugin install`.
- **`lint`** — проверяет любой payload против каждой известной ловушки:
  именованные чеки и предупреждения.
- **Скиллы + гайды** — учат AI-агента (или человека) всей системе, с
  провенансом каждого утверждения ([docs/internals.md](docs/internals.md)).

`create` и `lint` едут как `scripts/` внутри плагина, поэтому работают после
`agy plugin install`; из чекаута запускайте их напрямую через
`node plugins/antigravity-meta-plugin-kit/scripts/{create,lint}.mjs`.

## Установка как плагина

Мета-кит сам является Antigravity-плагином. Установите его прямо с GitHub
через Antigravity CLI — шесть meta-скиллов, четыре авторских сабагента и
slash-команды `/meta-*` приезжают в ваши сессии (после — перезапустите
Antigravity):

```bash
# клонирует репозиторий, регистрирует плагин, отслеживает в agy plugin list
agy plugin install https://github.com/sipki-tech/antigravity-meta-plugin-kit

# управление нативно
agy plugin list
agy plugin disable antigravity-meta-plugin-kit
agy plugin uninstall antigravity-meta-plugin-kit

# update = повторный install (заново клонирует последний main)
agy plugin install https://github.com/sipki-tech/antigravity-meta-plugin-kit
```

`agy plugin install` — **глобальный**: ставит в `~/.gemini/` для всех
воркспейсов. Чтобы ограничить плагин одним проектом, **положите его в репо
руками**: скопируйте payload в
`<project>/.agents/plugins/antigravity-meta-plugin-kit/` и закоммитьте.
Команды «установить в проект» нет — Antigravity сам обнаруживает всё, что
лежит под `.agents/` проекта (проверено: подхватываются обе формы —
`.agents/plugins/<name>/` и плоская `.agents/skills/<name>/`). См.
[гайд по манифесту](docs/guides/plugin-manifest.md).

## Быстрый старт

Инструменты `create` и `lint` живут в `scripts/` плагина. Из чекаута этого
репозитория:

```bash
S=plugins/antigravity-meta-plugin-kit/scripts

# сгенерировать новый native-only репозиторий плагина в ./my-plugin/
node "$S/create.mjs" my-plugin

# предпросмотр без записи на диск
node "$S/create.mjs" my-plugin --dry-run

# также сгенерировать пример сабагента (agents/*.toml — недокументированный формат)
node "$S/create.mjs" my-plugin --with-agents

# проверить существующий плагин (payload или корень скаффолд-репозитория)
node "$S/lint.mjs" my-plugin
```

Затем внутри скаффолда:

```bash
cd my-plugin
npm test                                   # зелёные из коробки
agy plugin validate plugins/my-plugin      # официальный структурный валидатор
agy plugin install plugins/my-plugin       # установка локального payload; agy plugin list для подтверждения
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
├── test/                       # unit + e2e (node --test), зелёные из коробки
├── README.md                   # установка через `agy plugin install https://github.com/…`
└── .github/workflows/ci.yml    # npm test + `agy plugin validate` (когда agy доступен)
```

Native-only по построению: ни `bin/` CLI, ни `installer/` — payload
устанавливается через `agy plugin install`, который клонирует, регистрирует и
обновляет его.

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
| записи хуков корректны (6 событий, обе формы, type=command) | сломанные обработчики |
| таймауты хуков корректны | нечисловые/отрицательные таймауты |
| скрипты хуков существуют / fail-open | хуки, ломающие сессию |
| agents/* минимально валидны (toml + md) | сломанные определения сабагентов |
| mcp: не-встроенные команды идут с disabled | отсутствующий бинарник ломает сессии |
| у workflows есть description во frontmatter | битые /slash-команды |
| rules непусты | мёртвая ссылка манифеста |

Warnings (на код выхода не влияют): hooks.json не в корне плагина
(`agy plugin validate` его не увидит), продублированный hooks.json с
расхождением, отсутствующий/завышенный таймаут (официальный default — 30с
блокировки), неизвестные события, `${PLUGIN_ROOT}` в командах хуков (раскрывается в
пустую строку на CLI 1.1.1 — используйте `node ./scripts/x.mjs`), стиль
имени скилла, закоммиченный `installed_version.json`.

Проверка fail-open — эвристика (обёртка `runHook(` или try/catch вокруг
тела): она ловит типичный промах, а не любой небезопасный скрипт.
Закоммиченный `installed_version.json` выводится как warning: это артефакт
времени установки, а не файл payload — его пишет IDE-менеджер плагинов, тогда
как `agy plugin install` вместо этого отслеживает плагин в
`import_manifest.json` (см. [internals](docs/internals.md)).

## Гайды

Подробные разборы каждого блока системы кастомизации Antigravity, каждый на
английском и русском:

| Гайд | Что покрывает |
|---|---|
| [Getting started](docs/guides/getting-started.md) · [RU](docs/guides/getting-started.ru.md) | scaffold → lint → test → `agy plugin install`, от и до |
| [Работа с плагином](docs/guides/using-the-plugin.md) · [RU](docs/guides/using-the-plugin.ru.md) | повседневность: триггеры скиллов, команды /meta-*, делегирование сабагентам, troubleshooting |
| [Манифест и раскладки](docs/guides/plugin-manifest.md) · [RU](docs/guides/plugin-manifest.ru.md) | поля plugin.json, два мира плагинов, installed_version.json, пути установки |
| [Хуки](docs/guides/hooks.md) · [RU](docs/guides/hooks.ru.md) | все шесть событий, включая недокументированный SessionStart (снят живой пробой), официальные wire-контракты, закон fail-open, матчеры, таймауты |
| [Скиллы](docs/guides/skills.md) · [RU](docs/guides/skills.ru.md) | анатомия SKILL.md, триггер-фразы, progressive disclosure, XML-шаблоны промптов |
| [Сабагенты](docs/guides/agents.md) · [RU](docs/guides/agents.ru.md) | формат agents/*.toml, модели, промпты, валидация |
| [Правила и воркфлоу](docs/guides/rules-workflows.md) · [RU](docs/guides/rules-workflows.ru.md) | иерархия GEMINI.md/AGENTS.md, триггеры правил, workflow-slash-команды |
| [MCP-серверы](docs/guides/mcp.md) · [RU](docs/guides/mcp.ru.md) | mcp_config.json, транспорты stdio/SSE, конвенция disabled:true, merge/prune |
| [Тестирование](docs/guides/testing.md) · [RU](docs/guides/testing.ru.md) | zero-dep доктрина node --test, e2e хуков, dry-run-ассерты |
| [Релиз](docs/guides/shipping.md) · [RU](docs/guides/shipping.ru.md) | нативная дистрибуция `agy plugin install`, маркетплейсы, CI-гейты, версии |
| [Исследование Antigravity](docs/guides/researching-antigravity.md) · [RU](docs/guides/researching-antigravity.ru.md) | откуда взят каждый факт: встроенные доки, строки бинарников, пробы валидатором — и как повторять после обновлений |

## Скиллы

Шесть портируемых Agent Skills в
[plugins/antigravity-meta-plugin-kit/skills/](plugins/antigravity-meta-plugin-kit/skills/):
`meta-scaffold`, `meta-hooks`, `meta-skills`, `meta-agents`, `meta-test`,
`meta-ship`.
[Установка плагина](#установка-как-плагина) доставляет их в Antigravity; для
других хостов скопируйте папку скилла в `~/.claude/skills/` (Claude Code)
или `~/.codex/skills/` (Codex).

## Реестр ловушек

[docs/internals.md](docs/internals.md) — канонический реестр всех ловушек
загрузчика, wire-форматов хуков и конвенций компонентов; каждое утверждение
помечено `[OFFICIAL 2026-07]`, `[OBSERVED 2026-07]` или `[MEDIUM]`, плюс
раздел «Опровергнутые слухи», который датирует собственные развороты
(`SessionStart`: опровергнут на 1.0.16, подтверждён вживую на 1.1.1, его
wire-контракт записан). Линтер его
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
Payload, который он генерирует, удовлетворяет форматам **обоих** миров —
богатый манифест IDE-менеджера плагинов и раскладку CLI customization root
(корневой `hooks.json`, минимальный манифест). Показанные здесь команды ставят
через CLI (`agy plugin install`), который пишет в `~/.gemini/config/plugins/`.
См. [гайд по манифесту](docs/guides/plugin-manifest.ru.md).

**Почему ноль зависимостей?** Инструменты и хуки запускаются на чужих машинах
внутри Antigravity; каждая зависимость — это поверхность атаки и время
установки. Встроенных модулей Node ≥18 (которые Antigravity везёт) достаточно.

**Почему плагин установился, но не загружается?** Если вы вручную скопировали
его в `~/.gemini/config/plugins/`, IDE-менеджеру плагинов нужен
`installed_version.json`, которого он не получил — устанавливайте через
`agy plugin install`, который регистрирует плагин за вас. См.
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
