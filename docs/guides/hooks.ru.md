# Хуки: события жизненного цикла, wire-контракты и закон fail-open

*[English](hooks.md) | Русский*

Хуки запускают внешние команды в фиксированных точках агентского цикла:
гейтят вызовы инструментов, инжектят контекст, не дают сессии остановиться.
Контракты ниже — из официальных доков внутри CLI (2026-07, CLI 1.0.10),
сверены с бинарником.

## hooks.json — форма файла

Расположение: **корень плагина** (`plugins/<name>/hooks.json`) —
официальное место и единственное, которое видит `agy plugin validate`.
Ключи верхнего уровня — **имена хуков** (любые строки; имя плагина — хорошая
конвенция против коллизий). Никогда не ставьте имя события на верхний
уровень — это форма `settings.json` из Claude Code, здесь она не загрузится.

```json
{
  "my-plugin": {
    "enabled": true,
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_ROOT}/scripts/example-guard.mjs\"",
            "timeout": 10,
            "statusMessage": "my-plugin: guard"
          }
        ]
      }
    ],
    "Stop": [
      { "type": "command", "command": "node \"${PLUGIN_ROOT}/scripts/keep-going.mjs\"", "timeout": 10 }
    ]
  }
}
```

- Именованные хуки из всех конфигов/плагинов **мерджатся**; обработчики
  одного события выполняются последовательно.
- `"enabled": false` временно выключает именованный хук.
- Поля обработчика: `type` (необязателен; существует только `"command"`),
  `command` (обязателен; `sh -c` на Unix, `cmd /c` на Windows; `~`
  разворачивается; **cwd = директория hooks.json**), `timeout` (секунды,
  **default 30** — ставьте 10–15 явно; хуки блокируют цикл синхронно).
  `statusMessage` — IDE-косметика, не официальное поле.

## Пять событий

| Событие | Срабатывает | Структура |
|---|---|---|
| `PreToolUse` | перед шагом инструмента | matcher-группа |
| `PostToolUse` | после шага инструмента | matcher-группа |
| `PreInvocation` | перед вызовом модели | плоский список |
| `PostInvocation` | после завершения tool-вызовов | плоский список |
| `Stop` | при завершении цикла | плоский список |

**`SessionStart` не существует** — слух из сети, опровергнут по бинарнику
(2026-07).

Матчеры (только для групповых событий): `""`/`"*"` = все инструменты; иначе
regex (`run_command`, `run_command|view_file`, `browser_.*`). Имена
инструментов — lowercased суффиксы `CORTEX_STEP_TYPE_*`.

## Wire-контракты

JSON на stdin → JSON на stdout. Все ключи camelCase. Общие поля входа:
`conversationId`, `workspacePaths[]`, `transcriptPath`,
`artifactDirectoryPath`, `modelName` (сегмент директории транскрипта зависит
от поверхности: `antigravity-cli/`, `antigravity/`, `antigravity-ide/`).

### PreToolUse — гейт вызовов инструментов

Вход дополняется `toolCall.name`, `toolCall.args` (например `CommandLine`),
`stepIdx`.

```json
{ "decision": "deny", "reason": "rm -rf / не пройдёт", "permissionOverrides": [] }
```

`decision`: `allow` | `deny` | `ask` (спросить пользователя; уважает кэш
«Always Allow») | `force_ask` (игнорировать кэш). Legacy-диалект
`{"allow_tool": bool, "deny_reason": "…"}` текущие сборки ещё парсят —
скаффолдный `denyResponse()` эмитит **оба** диалекта до 0.3.0.

### PostToolUse — наблюдение за результатами

Вход несёт `error`, если инструмент упал. Выход: **`{}`**. Не пытайтесь
инжектить здесь — это не верифицировано, а официальный контракт ждёт пустой
объект.

### PreInvocation — инъекция контекста

```json
{ "injectSteps": [
    { "userMessage": "видимое инжектированное сообщение" },
    { "ephemeralMessage": "временное системное сообщение" },
    { "toolCall": { "name": "…", "args": {} } } ] }
```

`{}` = тихий no-op.

### PostInvocation — механизм «продолжай работать»

Вход как у PreInvocation. Выход:

```json
{ "injectSteps": [], "terminationBehavior": "force_continue" }
```

`force_continue` возвращает в цикл; `terminate` останавливает; `""`/нет =
поведение по умолчанию.

### Stop — блокировка преждевременных остановок

Вход: `executionNum`, `terminationReason` (`model_stop` |
`max_steps_exceeded` | `error`), `error`, `fullyIdle`.

```json
{ "decision": "continue", "reason": "тесты ещё бегут" }
```

Любое decision, кроме `"continue"`, разрешает остановку; `reason`
инжектится системным сообщением при продолжении.

## Закон fail-open

Хук, бросивший исключение или вышедший с ненулевым кодом, деградирует или
ломает сессию пользователя. Прогоняйте каждый скрипт через обёртку, которая
ловит **всё** и эмитит безопасный ответ с exit 0 — скаффолдный
`scripts/lib/io.mjs`:

```js
import { runHook, commandLineOf, denyResponse } from "./lib/io.mjs";

export function checkCommand(cmd) {
  return /\brm\s+-rf\s+\//.test(cmd) ? denyResponse("blocked") : { decision: "allow", allow_tool: true };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  runHook((input) => checkCommand(commandLineOf(input)));
```

Извлекайте вход через адаптеры (`commandLineOf`, `promptTextOf`, `cwdOf`,
`editedFileOf`) — имена полей дрейфуют между preview-сборками. В stdout идёт
только одна строка JSON-ответа.

## Подводные камни

- Имя события на верхнем уровне → хук не загрузится (линт даёт FAIL).
- `hooks/hooks.json` вместо корня → невидим для `agy plugin validate`
  (линт предупреждает).
- Не взятый в кавычки `${PLUGIN_ROOT}` → ломается на путях с пробелами.
- Отсутствующий timeout → 30 секунд тихой блокировки на зависшем скрипте.
- Логи в stdout → портят JSON-ответ; используйте stderr.

## Чеклист

- [ ] hooks.json в корне плагина, только именованные хуки
- [ ] у каждого обработчика: command + явный timeout 10–15с
- [ ] каждый скрипт: обёрнут в runHook(), exit 0 на junk/пустом/битом stdin
- [ ] e2e-тест на каждый хук (см. [гайд по тестированию](testing.ru.md))

*См. также: [реестр ловушек](../internals.md) · [Тестирование](testing.ru.md)*
