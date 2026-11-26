# Исследование Antigravity

[English](researching-antigravity.md) | Русский

Как проверять контракты плагинов напрямую на установленной сборке Google
Antigravity после каждого обновления — без догадок и устаревших заметок.

## Зачем проверять эмпирически

Antigravity быстро развивается: только с июля по ноябрь 2026 года платформа
объединила загрузчики IDE и CLI (`Antigravity IDE 2.7.0` -> `agy --hub`),
заменила `agents/*.toml` на Markdown `agents/*.md`, убрала плагинные
`workflows/*.md`, добавила `SessionStart`, сменила enum причин `Stop` и
выпустила `agy plugin validate --strict`.

Каждое правило в [docs/internals.md](../internals.md) и `scripts/lib/lint.mjs`
помечено тегом источника (`[OFFICIAL 2026-11]`, `[OBSERVED 2026-11]`, `[MEDIUM]`)
и подкреплено воспроизводимой проверкой.

## Авторитетные источники на диске

После любого обновления Antigravity проверяйте эти четыре локальных источника:

1. **Точная версия CLI:**
   ```bash
   agy --version
   ```
   (`agy --version` всегда точен, тогда как `agy changelog` может отставать.)
2. **Встроенная документация Google**, поставляемая с CLI:
   `~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/`
   Содержит официальные спецификации манифеста, правил, скиллов, агентов, хуков,
   MCP, сайдкаров и приоритетов поиска.
3. **Два Go-бинарника движка:**
   - `~/.local/bin/agy` (движок CLI + валидатор + `--hub`)
   - `/Applications/Antigravity.app/Contents/Resources/bin/language_server`
     (движок Antigravity App)
   Сравнение строк и встроенных protobuf-дескрипторов (`exa.hooks_pb`) позволяет
   убедиться, что CLI и App идут синхронно.
4. **Живой `agy plugin validate --strict --json` + изолированные пробы `agy -p`:**
   Валидатор ловит изменения схемы, а изолированные запуски в `/tmp` выявляют
   runtime-поведение, невидимое валидатору (`PromptHook`, `Stop`
   `continuationActive`, маппинг тиров `model:` и `tools:` субагентов).

## Автоматический радар дрейфа (`probe.mjs`)

Вместо ручных проверок запускайте исполняемый радар дрейфа из кита:

```bash
# Быстро (~2с, без вызовов LLM): проверяет 9 контрактов валидатора в /tmp
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs probe --fast

# Машиночитаемый JSON
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs probe --fast --json

# Живые пробы (opt-in): дополнительно прогоняет 4 изолированных `agy -p` (хуки + субагенты) в /tmp
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs probe --live
```

`probe.mjs` никогда не трогает `~/.gemini/` и ваш проект — все синтетические
фикстуры создаются во временной папке и удаляются по завершении. Код `0`
означает `CONFIRMED` по всем контрактам; код `1` точно указывает ID пробы с
`DRIFT`.

Внутри Antigravity можно также вызвать `/meta-scout` — он прогонит `probe.mjs`
и делегирует углублённый анализ субагенту `meta-trap-scout` в песочнице.

## Повторяемый пайплайн после обновления

Проходите эти пять шагов после каждого апдейта `agy` или `Antigravity.app`:

1. Зафиксируйте версии: `agy --version` и `CFBundleShortVersionString` в
   `Info.plist` у `Antigravity.app` / `Antigravity IDE`.
2. Запустите `node plugins/antigravity-meta-plugin-kit/scripts/probe.mjs --fast`.
3. Сверьте `~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/`
   с [docs/internals.md](../internals.md) на предмет новых ключей манифеста,
   событий хуков, полей агентов или проверок валидатора.
4. Запустите `probe.mjs --live`, если в релизе менялись хуки, тиры субагентов
   или `PromptHook`.
5. Проверьте, не исправлен ли какой-то известный runtime-баг (например, заработал
   ли `PromptHook` или стал ли `Stop.continuationActive` равным `true` на
   `executionNum: 1`).

## Обновление `docs/internals.md` и `lint.mjs`

Когда проба сообщает `DRIFT`:

1. Обновите [docs/internals.md](../internals.md) с новой датой
   `[OFFICIAL YYYY-MM]` / `[OBSERVED YYYY-MM]` и перенесите устаревшие тезисы в
   раздел **Refuted & superseded assumptions**.
2. Синхронизируйте `scripts/lib/lint/*.mjs`, канонический шаблон SDK хуков
   (`scripts/templates/plugin/plugins/__name__/scripts/lib/io.mjs`) и ожидания в
   `scripts/probe.mjs` с подтверждённым поведением рантайма.
3. Отразите пользовательские изменения в обеих версиях гайдов (EN и RU) и
   запустите `npm test` (паритет проверяется через `test/docs-parity.test.mjs`).

Далее: [Внутренности](../internals.md) · [Тестирование](testing.ru.md) · [Работа с плагином](using-the-plugin.ru.md)
