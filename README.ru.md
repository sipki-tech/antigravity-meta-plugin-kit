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
пользователя. Этот кит кодирует каждую ловушку, найденную на практике (см.
[docs/internals.md](docs/internals.md)), в генератор и линтер — знание
становится исполняемым, а не устным.

## Быстрый старт

```bash
# создать новый репозиторий плагина в ./my-plugin/
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin

# предпросмотр без записи на диск
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --dry-run

# проверить существующий плагин (payload или корень скаффолд-репозитория)
npx github:sipki-tech/antigravity-meta-plugin-kit lint my-plugin

# обойти кэш npx и взять последний коммит
npx github:sipki-tech/antigravity-meta-plugin-kit#main create my-plugin
```

## Что генерирует `create`

```
my-plugin/
├── plugins/my-plugin/          # payload плагина
│   ├── plugin.json             # author-объект, блок interface, все поля
│   ├── hooks/hooks.json        # с неймспейсом; пример fail-open PreToolUse-хука
│   ├── scripts/example-guard.mjs + scripts/lib/io.mjs  # fail-open обёртка runHook()
│   ├── skills/my-plugin-example/SKILL.md  # корректный frontmatter + триггер-фраза
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
| hooks.json парсится / неймспейс / записи корректны | обе формы хуков |
| таймауты хуков заданы и ≤30с | хуки, блокирующие сессию |
| скрипты хуков существуют / fail-open | хуки, ломающие сессию |
| mcp: не-встроенные команды идут с disabled | отсутствующий бинарник ломает сессии |
| у workflows есть description во frontmatter | битые /slash-команды |
| rules непусты | мёртвая ссылка манифеста |

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
