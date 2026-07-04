# Тестирование: zero-dependency доктрина node --test

*[English](testing.md) | Русский*

Плагины работают внутри чужих сессий — непротестированный хук с ненулевым
exit-кодом роняет сессию. Доктрина: **логика импортируема, обёртки тонкие,
wire-контракты проверяются спауном**, ноль тест-фреймворков (только
`node:test` + `node:assert/strict`).

## Структура ради тестируемости

Держите поведение в экспортируемых функциях; исполняемый вход — одна строка
под гардом:

```js
export function checkCommand(cmd) { /* чистая логика */ }

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  runHook((input) => checkCommand(commandLineOf(input)));
```

Unit-тесты импортируют `checkCommand` напрямую — без спауна процессов,
суб-миллисекундные тесты.

## E2e хука — тестируйте провод, не только логику

```js
const res = spawnSync(process.execPath, [script], {
  input: JSON.stringify(input),
  encoding: "utf8",
  timeout: 10000,
});
assert.equal(res.status, 0);          // ВСЕГДА — даже на мусорном входе
const out = JSON.parse(res.stdout);
assert.equal(out.decision, "allow");  // официальный ключ
assert.equal(out.allow_tool, true);   // legacy-ключ, пока шаблон эмитит оба
```

Минимум три входа: реальная форма события, мусор
(`{"totally": "unexpected"}`) и пустой stdin. Fail-open хук отвечает
allow/silent с exit 0 на все.

## Тесты инсталлера — временные корни, никогда не ваш реальный home

```js
const home = mkdtempSync(join(tmpdir(), "my-plugin-test-"));
install({ home });                    // или { workspace: dir }
```

Явно проверяйте контракт журнала:

```js
const { actions } = install({ home, dryRun: true });
assert.ok(actions.length > 0);                      // план существует
assert.equal(existsSync(join(home, ".gemini")), false);  // ничего не записано
```

И контракт MCP: подсадите пользовательский сервер, выполните install и
uninstall, проверьте, что запись пользователя выжила байт-в-байт.

## CLI e2e

`spawnSync(process.execPath, [CLI, ...args], { cwd })`; проверяйте код
выхода, паттерны stdout и что пользовательские ошибки печатают дружелюбное
сообщение без стектрейса.

## Ловушки, в которые мы уже наступили за вас

- **`node --test <dir>` ломается на Node 22** (Node 20 сканирует
  директорию; 22 отвергает её). Используйте глоб в package.json:
  `"test": "node --test test/*.test.mjs"`.
- **Спаунутый `node --test` наследует `NODE_TEST_CONTEXT`**, когда родитель
  сам тест, — ребёнок рапортует успех, ничего не запуская. Если ваш тест
  спаунит другой test-runner, чистите env и проверяйте `# pass [1-9]` в
  выводе.
- С `pipefail` в CI конструкция `cmd | grep -q x` может маскировать или
  вскрывать ошибки пайпа — предпочитайте ассерты в тест-сьюте shell-пайпам.

## Интеграция с официальным валидатором

Гейтуйтесь на `agy plugin validate` там, где CLI есть, и скипайте в
остальных местах:

```js
const AGY = spawnSync("which", ["agy"], { encoding: "utf8" });
test("agy validate", (t) => {
  if (AGY.status !== 0) return t.skip("agy not on PATH");
  // спаун agy plugin validate, срезать ANSI, проверить "hooks : N processed"
});
```

## Чеклист

- [ ] каждый хук: unit-тест логики + e2e с реальным/мусорным/пустым stdin
- [ ] dry-run-тест доказывает ноль записей на диск
- [ ] MCP merge/prune покрыты с подсаженным пользовательским сервером
- [ ] `"test": "node --test test/*.test.mjs"` (глоб, не директория)
- [ ] CI-матрица гоняет это на ubuntu+macos × Node 20/22

*См. также: [Хуки](hooks.ru.md) · [Релиз](shipping.ru.md)*
