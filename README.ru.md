# antigravity-meta-plugin-kit

[English](README.md) | Русский

Мета-кит для разработки плагинов [Antigravity](https://antigravity.google):
**скаффолдер**, **линтер** и **набор скиллов**, которые учат AI-агента (или
человека) собирать корректные плагины, не открывая заново недокументированные
ловушки загрузчика.

## Зачем

У загрузчика плагинов Antigravity есть тихие и недокументированные режимы
отказа: плагин без `installed_version.json` игнорируется без единого слова;
строковый `author` ломает валидацию; хук, бросивший исключение, ломает сессию
пользователя. Этот кит кодирует каждую ловушку — из официальной документации
внутри CLI (2026-07) и из полевых наблюдений (см.
[docs/internals.md](docs/internals.md)) — в генератор и линтер: знание
становится исполняемым, а не устным.

Он дополняет официальный структурный валидатор: запускайте
`agy plugin validate plugins/<name>` для структуры CLI-мира
(skills/agents/commands/mcpServers/корневой hooks.json) и `lint` этого кита —
для ловушек IDE-мира плюс rules, workflows и стиля, которые официальный
валидатор игнорирует.

## Быстрый старт

```bash
# создать новый репозиторий плагина в ./my-plugin/
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin

# предпросмотр без записи на диск
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --dry-run

# проверить существующий плагин (payload или корень скаффолд-репозитория)
npx github:sipki-tech/antigravity-meta-plugin-kit lint my-plugin

# также сгенерировать пример сабагента (agents/*.toml — недокументированный формат)
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --with-agents

# обойти кэш npx и взять последний коммит
npx github:sipki-tech/antigravity-meta-plugin-kit#main create my-plugin
```

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

## Скиллы

Пять портируемых Agent Skills в [skills/](skills/): `meta-scaffold`,
`meta-hooks`, `meta-skills`, `meta-test`, `meta-ship`. Чтобы использовать,
скопируйте папку скилла в каталог скиллов вашего хоста — `~/.claude/skills/`
(Claude Code), `~/.codex/skills/` (Codex), `<project>/.agents/skills/` или в
`skills/` вашего плагина (Antigravity).

## Список ловушек

[docs/internals.md](docs/internals.md) — канонический реестр всех наблюдаемых
ловушек загрузчика и wire-форматов хуков с датами наблюдений. Линтер его
реализует; скиллы на него ссылаются.

## Связь с antigravity-kit

[antigravity-kit](https://github.com/sipki-tech/antigravity-kit) — эталонная
реализация, из которой извлечён каждый паттерн этого кита, и первый
потребитель линтера: CI клонирует его и линтует его payload на каждом пуше
(dogfood-гейт).

## Разработка

```bash
npm test          # node --test; включает dogfood-набор, когда рядом есть
                  # ../antigravity-kit (или задан AGY_KIT_PAYLOAD)
```

Ноль runtime-зависимостей (только встроенные модули Node ≥18). См.
[CONTRIBUTING.md](CONTRIBUTING.md).

## Лицензия

MIT
