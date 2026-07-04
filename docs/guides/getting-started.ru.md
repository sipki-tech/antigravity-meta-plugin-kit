# Быстрый старт: от нуля до установленного плагина Antigravity

*[English](getting-started.md) | Русский*

Этот гайд проходит весь путь: scaffold → lint → test → install → verify.
Бюджет времени: около пяти минут.

## 1. Скаффолд

```bash
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin
cd my-plugin
```

Имена — kebab-case (`my-plugin`, не `My_Plugin`). Добавьте `--dry-run`,
чтобы увидеть точный план файлов без записи, `--dir <parent>` — чтобы
сгенерировать в другом месте, `--with-agents` — чтобы включить пример
сабагента.

Вы получаете полный репозиторий: payload в `plugins/my-plugin/`, инсталлер
(`installer/` + `bin/cli.mjs`), тесты и CI. Всё связано так, что четыре
проверочные команды ниже проходят сразу — ваша задача заменить примеры
реальным поведением, перезапуская проверки по ходу.

## 2. Линт

```bash
npx github:sipki-tech/antigravity-meta-plugin-kit lint .
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
stdin/stdout) и инсталлер (dry-run ничего не пишет; install + verify
проходят; uninstall сохраняет пользовательские MCP-записи). Расширяйте его
по мере добавления поведения — доктрину объясняет
[гайд по тестированию](testing.ru.md).

## 4. Установка

```bash
# в проект (коммитится, попадает в <project>/.agents/)
node bin/cli.mjs install --workspace

# глобально (все воркспейсы): ~/.gemini/config/plugins/my-plugin/
node bin/cli.mjs install

# всегда доступно:
node bin/cli.mjs install --dry-run
```

Инсталлер копирует payload, пишет `installed_version.json` (без него
загрузчик молча игнорирует плагин) и неразрушающе мерджит MCP-серверы.
Перезапустите Antigravity, чтобы плагин подхватился.

## 5. Verify

```bash
node bin/cli.mjs verify --workspace   # или без флага для глобальной установки
```

Именованные чеки: директория плагина, манифест парсится, author — объект,
installed_version присутствует и совпадает, hooks.json объявляет именованный
хук, гард-скрипт на месте. Exit 1 при любом провале.

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
- [ ] реальная установка + `verify` — зелёные
- [ ] примеры заменены реальным поведением (в plugin.json не осталось TODO)
