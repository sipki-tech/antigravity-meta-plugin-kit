# Быстрый старт

[English](getting-started.md) | Русский

Путь от нуля до проверенного и протестированного плагина Google Antigravity
(`agy 1.5.17+`) меньше чем за пять минут.

## Требования

- **Node.js >= 20** (нулевые npm-зависимости).
- **Google Antigravity CLI (`agy 1.5.17+`)** в `PATH` для локальной валидации и
  установки (`agy --version`).

## 1. Установите в Antigravity и настройте `meta-kit`

Установите кит глобально — `git clone` и `npm install` не нужны:

```bash
agy plugin install https://github.com/sipki-tech/antigravity-meta-plugin-kit
```

Добавьте алиас (в `~/.zshrc` или `~/.bashrc`), чтобы вызывать `meta-kit` из
любой директории:

```bash
alias meta-kit='node ~/.gemini/config/plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs'
```

*(Работаете из клона этого репозитория? Используйте
`alias meta-kit="node $(pwd)/plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs"`.)*

## 2. Сгенерируйте нативный плагин Antigravity

```bash
meta-kit create my-plugin
```

В `./my-plugin/` будет создана готовая структура:

- `plugins/my-plugin/plugin.json` — плоский строгий манифест `agy 1.5.17+` с
  `displayName`, `logo` и `suggestedPrompts`.
- `plugins/my-plugin/README.md` + `assets/logo.svg` — готовый к Marketplace
  readme и SVG 256×256 с полями ~10% (0 `note` в валидаторе).
- `plugins/my-plugin/rules/AGENTS.md` — компактное always-on правило (без
  frontmatter).
- `plugins/my-plugin/hooks.json` + `scripts/example-guard.mjs` +
  `scripts/lib/io.mjs` — symlink-safe fail-open guard-хук на `PreToolUse`.
- `plugins/my-plugin/skills/my-plugin-example/SKILL.md` +
  `resources/prompt-template.md`.
- `plugins/my-plugin/mcp_config.json` — чистый JSONC-шаблон.
- `test/hook.test.mjs`, `test/manifest.test.mjs`, `package.json`, `README.md` и
  `.github/workflows/ci.yml`.

### Выбор профиля генерации

Комбинируйте флаги под задачи своего плагина:

| Что вы делаете | Команда |
|---|---|
| Стандартный плагин (хуки + MCP + скилл + правило) | `meta-kit create my-plugin` |
| Минимальный плагин (только скилл и правило) | `meta-kit create my-minimal --minimal` |
| Паттерн Google Workspace (встроенный CLI + `auth.json` + скилл, без MCP) | `meta-kit create my-cli --minimal --with-cli` |
| Канонический Markdown-субагент (`agents/*.md`) + slash-обёртка `/<name>-help` | `meta-kit create my-agents --with-agents` |
| Фоновый воркер-сайдкар (`sidecars/<name>-worker/sidecar.json`) | `meta-kit create my-worker --with-sidecar` |
| Манифест в `.antigravity-plugin/plugin.json` (компоненты в корне) | `meta-kit create my-dot --manifest-layout dot-antigravity` |
| Предпросмотр плана без записи на диск | `meta-kit create my-preview --with-agents --with-cli --dry-run` |

## 3. Запустите тесты, офлайн-линтер и официальный валидатор

```bash
cd my-plugin
npm test                                               # тесты node:test (зелёные из коробки)
meta-kit lint --strict .                               # офлайн строгий линт + слепые зоны
agy plugin validate --strict --json plugins/my-plugin  # официальный валидатор Google (findings: [])
```

Оба инструмента должны пройти с **0 ошибок и 0 предупреждений**.

## 4. Проверьте окружение и установите локально

Запустите read-only диагностику до и после установки, чтобы убедиться в
отсутствии коллизий имён в `~/.gemini/config/plugins/`:

```bash
meta-kit doctor --workspace .
agy plugin install plugins/my-plugin
agy plugin list --json
```

Для изоляции без изменения `~/.gemini/config/plugins/` скопируйте
`plugins/my-plugin` в `<project>/.agents/plugins/my-plugin` и запустите:

```bash
agy -p "List the skills available from my-plugin." --add-dir <project>
```

## Дальнейшие шаги

- Готовые промпты для скиллов и субагентов внутри Antigravity:
  [Работа с плагином](using-the-plugin.ru.md)
- Грамотное описание субагентов: [Субагенты](agents.ru.md)
- Безопасные хуки жизненного цикла: [Хуки жизненного цикла](hooks.ru.md)
- Подготовка к GitHub и Marketplace: [Релиз](shipping.ru.md)
