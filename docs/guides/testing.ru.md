# Тестирование плагинов

[English](testing.md) | Русский

Надёжные плагины Antigravity проверяются на четырёх быстрых взаимодополняющих
уровнях без сторонних тест-фреймворков (только встроенные `node:test` и
`node:assert/strict`).

## Четыре слоя проверки

1. **Юнит- и e2e-тесты (`npm test`)** — детерминированные офлайн-тесты на
   `node:test` для протокола хуков, fail-open поведения и инвариантов манифеста.
2. **Офлайн строгий линт (`lint.mjs --strict`)** — работает в CI без `agy`,
   покрывая правила `agy plugin validate --strict` плюс runtime-слепые зоны.
3. **Официальный валидатор (`agy plugin validate --strict --json`)** —
   авторитетный структурный оракул Google локально (и в CI, если `agy` доступен).
4. **Изолированный живой smoke-тест `agy -p`** — проверяет реальную загрузку
   субагентов, срабатывание хуков и ограничения инструментов в одноразовом `/tmp`.

## 1. Юнит- и e2e-тесты на `node:test`

Запуск всего набора:

```bash
npm test    # выполняет `node --test`
```

Базовый шаблон включает два стартовых тест-файла (`--minimal` опускает
`hook.test.mjs`, а `--with-cli` добавляет `test/cli.test.mjs`):
- `test/manifest.test.mjs` — проверяет строгий JSON, semver `version`,
  kebab-case `name`, наличие `logo` и валидный `hooks.json` (если присутствует).
- `test/hook.test.mjs` — запускает реальный скрипт хука дочерним процессом,
  подаёт camelCase protojson `agy 1.5.17` в `stdin` и проверяет код `0` +
  валидный JSON на `stdout`.

### E2E-тестирование хуков `PreToolUse` и `Stop`

Всегда покрывайте **четыре сценария** для каждого скрипта хука:
1. **Разрешающий путь** — безопасный ввод возвращает `{"decision": "allow"}`
   (или `{}` / `{"decision": ""}`).
2. **Блокировка / модификация** — целевой триггер возвращает точный ожидаемый
   ответ `deny`, `overwrite`, `injectSteps` или `continue`.
3. **Битый или пустой stdin** — невалидный JSON или `{}` всё равно завершаются
   с кодом `0` и fail-open ответом (без исключений и ненулевых кодов).
4. **Защита от цикла (для `Stop`)** — хук обязан возвращать `{"decision": ""}`
   при `terminationReason !== "NO_TOOL_CALL"`, при `continuationActive: true`
   **и** при `continuationActive: false` с `executionNum: 1` (обход бага
   `continuationActive` в `agy 1.5.17`).

```js
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";

function runHook(script, stdin) {
  const res = spawnSync(process.execPath, [script], {
    input: typeof stdin === "string" ? stdin : JSON.stringify(stdin),
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(res.status, 0, `hook exited ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout.trim());
}

test("PreToolUse blocks dangerous command and fails open on garbage", () => {
  const blocked = runHook("plugins/my-plugin/scripts/example-guard.mjs", {
    hookEventName: "PreToolUse",
    toolCall: { id: "1", name: "run_command", args: { CommandLine: "rm -rf /" } },
  });
  assert.equal(blocked.decision, "deny");

  const failOpen = runHook("plugins/my-plugin/scripts/example-guard.mjs", "{not-json");
  assert.equal(failOpen.decision, "allow");
});
```

## 2. Офлайн строгий линт (`lint.mjs --strict`)

Запускайте линтер локально и в каждом GitHub Actions джобе:

```bash
node plugins/antigravity-meta-plugin-kit/scripts/lint.mjs --strict .
node plugins/antigravity-meta-plugin-kit/scripts/lint.mjs --strict --json .
```

В монорепозитории добавляйте `--all`, чтобы проверить все плагины в `plugins/`.
Флаг `--strict` превращает предупреждения в exit code `1`, поэтому
runtime-ловушки (`agents/*.toml`, неизвестные `tools:`, `grep_search`,
`type: "prompt"`, отсутствие защиты цикла `Stop`, скобки `{a,b}` в `globs`,
`/sse` в MCP) сразу ловятся в CI.

## 3. Официальный валидатор (`agy plugin validate --strict --json`)

Когда `agy` установлен локально, запускайте валидатор Google и требуйте пустой
массив `findings`:

```bash
agy plugin validate --strict --json plugins/my-plugin
```

Эту проверку удобно обернуть в тест `node:test`, который аккуратно пропускается,
если `agy` отсутствует в `PATH` (см. `test/agy-validate.test.mjs` в этом репо).

## 4. Изолированный живой smoke-тест через `agy -p`

Перед релизом плагина с субагентами или хуками прогоните его в чистой папке
`/tmp`, не трогая `~/.gemini/config/plugins/`:

```bash
WS=$(mktemp -d /tmp/agy-smoke-XXXXXX)
mkdir -p "$WS/.git" "$WS/.agents/plugins"
cp -R plugins/my-plugin "$WS/.agents/plugins/my-plugin"

agy -p "Confirm which subagents and skills from my-plugin are visible." \
  --add-dir "$WS" \
  --model gemini-3.8-flash-low \
  --print-timeout 45s

rm -rf "$WS"
```

Обязательно передавайте `--add-dir "$WS"` — неинтерактивный `agy -p` загружает
`.agents/plugins/` только из явно подключённых директорий.

## Проверка паритета документации

Если в плагине есть двуязычная документация (EN + RU), держите компактный тест
паритета (как `test/docs-parity.test.mjs` в этом репозитории), который
проверяет:
- Идентичную иерархию заголовков в каждой паре `.md` / `.ru.md`.
- Ссылки внутри `.ru.md` ведут на русские `.ru.md` страницы.
- Отсутствие устаревших и сломанных паттернов в доках, скиллах, агентах и
  шаблонах.

Далее: [Релиз](shipping.ru.md) · [Хуки жизненного цикла](hooks.ru.md) · [Исследование Antigravity](researching-antigravity.ru.md)
