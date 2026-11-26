# Хуки жизненного цикла

[English](hooks.md) | Русский

Хуки жизненного цикла позволяют плагину проверять, блокировать, модифицировать
или аннотировать ходы агента в шести детерминированных точках цикла Antigravity.
Все протокольные контракты и ловушки ниже подтверждены живыми пробами на
`agy 1.5.17`.

## Расположение и схема `hooks.json`

- Файл должен лежать строго по пути `<plugin>/hooks.json` в **строгом JSON**
  (комментарии и висячие запятые дают жёсткую ошибку; `hooks/hooks.json` в
  нативных плагинах не загружается).
- Ключи верхнего уровня — **именованные группы хуков** (имена событий в корне
  вызывают жёсткую ошибку). У группы можно указать `"enabled": false`.
- Каждый обработчик задаёт `"type": "command"`, `"command"` (выполняется через
  `sh -c` из корня плагина) и `"timeout"` (целые секунды, по умолчанию `30`; с
  `1.5.14` при таймауте убивается вся группа процессов).
- Запускайте скрипты относительным путём `node ./scripts/guard.mjs`. **Не**
  пишите `${PLUGIN_ROOT}` или `$PLUGIN_ROOT` в `command` — `agy plugin validate
  --strict` отклоняет это (рантайм уже выставляет `cwd` в корень плагина и
  передаёт `PLUGIN_ROOT`, а для установленных плагинов ещё и `PLUGIN_DATA` в
  переменных окружения).

```json
{
  "my-plugin-guards": {
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "node ./scripts/example-guard.mjs",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

## Шесть нативных событий

| Событие | Формат в JSON | Когда срабатывает |
|---|---|---|
| `SessionStart` | плоский `[handler, ...]` | Один раз при старте новой сессии. |
| `PreToolUse` | сгруппированный `[{"matcher": "<regex>", "hooks": [...]}]` | До запуска подходящего инструмента; может разрешить, запретить, запросить подтверждение или переписать аргументы. |
| `PostToolUse` | сгруппированный `[{"matcher": "<regex>", "hooks": [...]}]` | После завершения инструмента (логирование, телеметрия, сайд-эффекты). |
| `PreInvocation` | плоский `[handler, ...]` | Перед вызовом модели; может инжектить шаги или прервать ход. |
| `PostInvocation` | плоский `[handler, ...]` | После вызова модели; может инжектить шаги, прервать или сделать `force_continue`. |
| `Stop` | плоский `[handler, ...]` | Перед остановкой агента; может отпустить ход или потребовать продолжение. |

Регулярные выражения `matcher` в `PreToolUse` / `PostToolUse` должны совпадать с
нативными именами инструментов Antigravity (`run_command`, `write_file`,
`edit_file`, `read_file`). Плоские массивы на tool-событиях тихо не запускаются;
matcher-группы на плоских событиях дают жёсткую ошибку.

## Общие поля stdin

Живые пробы подтвердили, что **все 6 событий** (включая `SessionStart`) получают
полный camelCase protojson конверт в `stdin`:

- `conversationId` — уникальный ID диалога
- `workspacePaths` — массив активных директорий воркспейса
- `transcriptPath` — путь к файлу транскрипта
- `artifactDirectoryPath` — путь к директории артефактов
- `modelName` — ID текущей модели
- `lastUserInput` — последнее сообщение пользователя
- `hookEventName` — имя события (`SessionStart`, `PreToolUse` и т.д.)
- `cwd` — рабочая директория **агента** (отличается от `process.cwd()` самого
  хука, который равен корню плагина)

## Контракты и ответы по событиям

### `SessionStart`

- **Дополнительные поля stdin:** нет (только 8 общих полей).
- **Stdout:** `{}` (ничего не делать) или `{"injectSteps": [...]}` (обычно шаг
  `systemMessage` для инициализации контекста сессии).

### `PreToolUse` (включая `overwrite`)

- **Дополнительные поля stdin:** `toolCall: { id, name, args }`, `stepIdx`.
- **Stdout:**
  - Разрешить: `{"decision": "allow"}`
  - Запретить: `{"decision": "deny", "reason": "Объясните причину, чтобы агент адаптировался"}`
  - Спросить пользователя: `{"decision": "ask", "reason": "...", "permissionOverrides"?: [...]}`
    или `{"decision": "force_ask", ...}`
  - Переписать аргументы перед выполнением (**проверено вживую на `1.5.17`**):

```json
{
  "decision": "allow",
  "overwrite": { "CommandLine": "npm test -- --reporter=spec" }
}
```

`overwrite` делает поверхностное слияние ключей верхнего уровня в `toolCall.args`
и добавляет к результату инструмента уведомление об изменённых ключах.

### `PostToolUse`

- **Дополнительные поля stdin:** `toolCall`, `stepIdx`, `error`.
- **Stdout:** `{}`. Proto-поле `overwriteResult` в command-хуках `1.5.17`
  игнорируется — используйте `PostToolUse` для аудита, метрик и внешних эффектов,
  а не для правки вывода инструмента.

### `PreInvocation` и `PostInvocation`

- **Дополнительные поля stdin:** `invocationNum`, `initialNumSteps`.
- **Stdout:** `{"injectSteps": [...], "terminationBehavior": "" | "terminate" | "force_continue"}`
  (`force_continue` допустим только в `PostInvocation`; `terminate` работает в обоих).
- **Валидные элементы `injectSteps`:**
  - `{"systemMessage": {"systemMessage": "...", "metadata": {"user_markdown": "..."}}}`
    — канонический вложенный объект (`metadata.user_markdown` рендерится
    пользователю, не попадая в контекст модели).
  - `{"userMessage": "..."}` — инжектит синтетическое сообщение пользователя.
  - `{"errorMessage": {"userMessage": "..."}}` — показывает ошибку пользователю
    (в паре с `"terminationBehavior": "terminate"`).

### `Stop` и баг `continuationActive`

- **Дополнительные поля stdin:** `executionNum`, `terminationReason`, `error`,
  `fullyIdle`, `continuationActive`.
- **Официальные значения `terminationReason`:** `NO_TOOL_CALL` (штатная
  остановка модели), `MAX_INVOCATIONS`, `MAX_FORCED_INVOCATIONS`,
  `MAX_TOKEN_BUDGET_EXCEEDED`, `ERROR`, `USER_CANCELED`, `TERMINAL_STEP_TYPE`,
  `TERMINAL_CUSTOM_HOOK`, `INJECTED_RESPONSE`.
- **Stdout:** `{"decision": ""}` (разрешить остановку) или
  `{"decision": "continue", "reason": "Что нужно завершить перед остановкой"}`.

> **Критичный баг `agy 1.5.17`:** Живые пробы показали, что `continuationActive`
> остаётся `false` даже на `executionNum: 1` и `executionNum: 2` после ответа
> `{"decision": "continue"}`. `Stop`-хук, проверяющий только
> `input.continuationActive`, может уйти в цикл. **Всегда проверяйте оба поля:**
> `isStopContinuation(input)` (`Boolean(input?.continuationActive || input?.executionNum > 0)`).

## Fail-open обработчики на `io.mjs`

Упавший хук (ненулевой exit code, синтаксическая ошибка, необработанное
исключение или обрезанный stdout) ломает сессию пользователя. Каждый
сгенерированный плагин поставляет zero-dep модуль `scripts/lib/io.mjs`:

```js
#!/usr/bin/env node
import {
  ALLOW,
  commandLineOf,
  denyResponse,
  runHook,
} from "./lib/io.mjs";

const BLOCKED = [/\brm\s+-rf\s+\/(?:\s|$)/];

runHook((input) => {
  const cmd = commandLineOf(input);
  for (const re of BLOCKED) {
    if (re.test(cmd)) {
      return denyResponse("Refusing destructive root delete.");
    }
  }
  return ALLOW;
}, ALLOW);
```

`runHook(handler, fallback)`:
1. Читает JSON из stdin с защитным таймаутом 3 секунды, чтобы незакрытый pipe не
   подвесил сессию.
2. Перехватывает синхронные и асинхронные ошибки и возвращает `fallback`
   (`ALLOW`, `SILENT` или `STOP_ALLOW`).
3. Сбрасывает буфер `stdout` перед `process.exit(0)`, чтобы длинный JSON не
   обрезался.

Экспорты `io.mjs`:
- **PreToolUse:** `ALLOW`, `denyResponse`, `askResponse`, `forceAskResponse`,
  `overwriteResponse`
- **Session / Invocation:** `SILENT`, `systemMessageResponse`, `injectResponse`,
  `errorTerminateResponse`, `forceContinueResponse`
- **Stop:** `STOP_ALLOW`, `continueStopResponse`, `isStopContinuation`
- **Адаптеры ввода:** `hookEventNameOf`, `toolCallIdOf`, `commandLineOf`,
  `promptTextOf`, `transcriptPathOf`, `cwdOf`, `editedFileOf`

## Подтверждённые runtime-ловушки

Каждая из ловушек ниже проходит `agy plugin validate --strict` (или тихо
ломается в рантайме) и явно отлавливается `lint.mjs`:

1. **Хуки `type: "prompt"` валят каждый подходящий вызов инструмента.** Они
   проходят `agy plugin validate --strict`, но `agy 1.5.17` падает в рантайме с
   `prompt hooks are not currently supported`. Всегда используйте `"type": "command"`.
2. **`injectSteps: [{"toolCall": ...}]` роняет ход с кодом выхода 3**
   (`unknown injected step type: <nil>`). Никогда не отправляйте `toolCall`-шаги.
3. **`ephemeralMessage` устарел** — используйте вложенный объект
   `{"systemMessage": {"systemMessage": "..."}}` через `systemMessageResponse()`.
4. **Не проверяйте устаревшую строчную причину остановки** — нормальное
   завершение модели приходит как `terminationReason === "NO_TOOL_CALL"`.
5. **Не кладите навязчивые глобальные `Stop`-хуки** в утилитарные плагины.
   Глобально установленный хук срабатывает в *каждом* проекте пользователя.
   Держите хуки узкими, опциональными или локальными в `.agents/hooks.json`.

Далее: [Тестирование](testing.ru.md) · [Субагенты](agents.ru.md) · [Внутренности](../internals.md)
