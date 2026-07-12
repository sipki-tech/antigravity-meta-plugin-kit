# Быстрый старт: от нуля до установленного плагина Antigravity

*[English](getting-started.md) | Русский*

Этот гайд проходит весь путь: scaffold → lint → test → install → confirm.
Бюджет времени: около пяти минут.

## 1. Скаффолд

```bash
S="$(pwd)/plugins/antigravity-meta-plugin-kit/scripts"   # абсолютный — переживает cd ниже
node "$S/create.mjs" my-plugin
cd my-plugin
```

Имена — kebab-case (`my-plugin`, не `My_Plugin`). Добавьте `--dry-run`,
чтобы увидеть точный план файлов без записи, `--dir <parent>` — чтобы
сгенерировать в другом месте, `--with-agents` — чтобы включить пример
сабагента.

Вы получаете полный **native-only** репозиторий: payload в
`plugins/my-plugin/`, тесты и CI — устанавливается через `agy plugin install`,
без встроенного инсталлера. Всё связано так, что гейты ниже проходят сразу —
ваша задача заменить примеры реальным поведением, перезапуская проверки по
ходу.

## 2. Линт

```bash
node "$S/lint.mjs" .
```

`lint` принимает payload-директорию или корень скаффолд-репозитория. Он
печатает именованные чеки (`ok /FAIL name (note)`), затем warnings, затем
notes, и выходит с кодом 1 при любом FAIL. Каждый чек соответствует
реальному режиму отказа загрузчика — см. [реестр ловушек](../internals.md).

Также запустите официальный структурный валидатор (идёт с CLI `agy`):

```bash
agy plugin validate plugins/my-plugin
```

Они покрывают разное: `agy` проверяет структуру CLI-мира
(skills/agents/commands/mcpServers/корневой hooks.json); `lint` — ловушки
манифеста IDE-мира, содержимое хуков, rules, workflows и стиль.

## 3. Тесты

```bash
npm test
```

Скаффолдный набор покрывает пример-хук (unit + e2e через реальный
stdin/stdout) и любой инструмент из `scripts/` (dry-run ничего не пишет).
Расширяйте его по мере добавления поведения — доктрину объясняет
[гайд по тестированию](testing.ru.md).

## 4. Установка

```bash
# установить локальную payload-папку прямо через Antigravity CLI
agy plugin install plugins/my-plugin
```

CLI копирует payload в `~/.gemini/config/plugins/my-plugin/`, регистрирует его
в `~/.gemini/config/import_manifest.json` и резолвит любой MCP-конфиг,
который везёт плагин. Перезапустите Antigravity, чтобы плагин подхватился.
Чтобы установить с GitHub, передайте URL репозитория:
`agy plugin install https://github.com/you/my-plugin`.

## 5. Confirm

```bash
agy plugin list                 # плагин должен быть в списке
```

`agy plugin list` показывает установленные через CLI плагины — самое быстрое
подтверждение, что установка зарегистрировалась. Живая сессия, срабатывающая
скиллами плагина, — финальное доказательство; `agy plugin uninstall my-plugin`
чисто его удаляет.

## Куда дальше

| Хотите… | Гайд |
|---|---|
| разобраться в plugin.json и путях установки | [Манифест и раскладки](plugin-manifest.ru.md) |
| блокировать/инжектить/не давать остановиться через хуки | [Хуки](hooks.ru.md) |
| писать скиллы, которые реально срабатывают | [Скиллы](skills.ru.md) |
| добавить сабагентов | [Сабагенты](agents.ru.md) |
| добавить правила или /slash-воркфлоу | [Правила и воркфлоу](rules-workflows.ru.md) |
| привезти MCP-серверы | [MCP-серверы](mcp.ru.md) |
| выпустить релиз | [Релиз](shipping.ru.md) |

## Чеклист

- [ ] `lint` — ноль FAIL, ноль warnings
- [ ] `agy plugin validate` — `[ok]`, hooks processed
- [ ] `npm test` — зелёный
- [ ] реальный `agy plugin install` + `agy plugin list` — плагин в списке
- [ ] примеры заменены реальным поведением (в plugin.json не осталось TODO)
