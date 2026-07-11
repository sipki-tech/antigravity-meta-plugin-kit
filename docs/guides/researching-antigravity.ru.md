# Исследование внутренностей Antigravity: источники, техники, воспроизводимый пайплайн

*[English](researching-antigravity.md) | Русский*

Как был добыт каждый факт из [internals.md](../internals.md) — по убыванию
надёжности, с точными командами, чтобы исследование можно было повторить
после любого обновления Antigravity. Это же — плейбук сабагента
`meta-trap-scout`.

## Иерархия источников (от надёжного к слабому)

| # | Источник | Где | Что даёт |
|---|---|---|---|
| 1 | Встроенные официальные доки | `~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/` + `antigravity_guide/references/` | канонические спеки: plugins, skills, hooks, rules, MCP, реестры; обзоры app/cli/ide/sdk |
| 2 | Строки бинарников | `~/.local/bin/agy`, Go-сайдкары `language_server` обоих приложений | встроенные доки, системные промпты, имена proto-типов, полный список событий |
| 3 | Пробы валидатором | `agy plugin validate` на подсаженных payload | эмпирическое поведение компонентов (что считает, что скипает) |
| 4 | Живые установки | `~/.gemini/config/plugins/*`, файлы настроек | реальные конвенции (включая плагины самого Google) |
| 5 | Официальный веб | antigravity.google/docs, codelabs, agentskills.io, agents.md | нарративы, туториалы; менее точен, чем №1 |
| 6 | Комьюнити-веб | блоги, agentpedia, reddit | наводки и слухи — **проверять по №1–3 прежде чем верить** |

Показательный случай — теперь урок о дрейфе в двух актах: веб настаивал на
существовании хука `SessionStart`; бинарники 1.0.16 это опровергали (в agy
совпадения — TLS `ClientSessionStartReq`, в приложениях — JS-жесты
`onPanSessionStart`). А в бинарнике 1.1.1 выросло настоящее proto-семейство
`SessionStartHookArgs`/`SessionStartHookResult` (2026-07-11). Слух в итоге
оказался прав — но только улики рангов 1–3 могли сказать, *когда*, и
wire-контракт всё ещё ждёт живой пробы. Ранг 6 никогда не перевешивает
ранг 2 — он лишь подшивает наводки.

## Источник 1 — встроенные доки

Найдены через `agy changelog`, упомянувший «`antigravity_guide` builtin
skill» и «builtin customizations directory»:

```bash
find ~/.gemini/antigravity-cli/builtin -type f
# agy-customizations/docs/{plugins,skills,hooks,rules,mcp_servers,json_configs}.md
# antigravity_guide/references/{app,cli,ide,sdk}.md
```

Директория обновляется вместе с CLI (`.checksum`). Снимайте снапшот до
обновления, диффайте после:

```bash
cp -R ~/.gemini/antigravity-cli/builtin /tmp/builtin-<версия>
agy update
diff -r /tmp/builtin-* ~/.gemini/antigravity-cli/builtin
```

## Источник 2 — строки бинарников

Движок несут три Go-бинарника (Electron-овский `app.asar` — лаунчер на
2 МБ; сам UI вшит в Go-сайдкар):

```bash
strings -n 5 ~/.local/bin/agy > agy.txt                     # ~490 тыс. строк
strings -n 6 "/Applications/Antigravity.app/Contents/Resources/bin/language_server" > app20.txt
strings -n 6 "/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/bin/language_server_macos_arm" > ide.txt
```

Сработавшие техники:

- **Сначала счётчики, потом контексты**: `grep -c pattern` по всем дампам,
  чтобы понять, где что живёт; затем `grep -n -B1 -A1` или
  `grep -o ".\{80\}pattern.\{120\}"` (Go-таблицы строк склеивают тысячи
  литералов в одну строку — голый `grep -n` печатает мегабайты).
- **Извлечение встроенных доков**: markdown внутри бинарника выживает как
  чистый многострочный текст — найдите заголовок (`# Lifecycle Hooks`) и
  `sed -n 'START,ENDp'`. Так был добыт полный официальный контракт хуков
  раньше, чем он появился в вебе.
- **Proto-имена = инвентарь API**:
  `grep -o "[A-Za-z]*Hook\(Args\|Result\)" | sort -u` перечисляет реальный
  набор событий; наличие `GetSkillSlashCommands` при отсутствии
  `GetAgentSlashCommands` доказало, что агенты не становятся slash-командами.
- **Системные промпты ищутся**: «You are a subagent of Antigravity»,
  таблица рутин оркестратора owl и шаблон ростера плагинов («You can use
  them just like regular skills or subagents») — всё из строк.
- **Добивайте ложные срабатывания**: каждому хиту — чтение контекста.
  `SessionStart` (TLS/JS-шум) и `owl` (подстрока тысяч слов) на уровне
  счётчиков выглядели настоящими.

Ловушка версий: **`agy changelog` отстаёт от бинарника** (установка 1.0.16
показывает сверху 1.0.10). Авторитетна строка «current version» из
`agy update`.

## Источник 3 — пробы валидатором

`agy plugin validate [path]` (найден через `agy plugin --help`) —
бесплатный оракул: сгенерируйте payload, подсадите вариацию, прочитайте,
что он посчитал.

```bash
node bin/cli.mjs create probe && cd probe/plugins/probe
mkdir commands && printf -- "---\ndescription: t\n---\nbody\n" > commands/x.md
TERM=dumb agy plugin validate . | sed 's/\x1b\[[0-9;]*m//g'
# → "commands : 1 processed (converted to skills)"  ← открытие
```

Так установлены: `commands/` (стиль Claude Code, конвертируются в скиллы),
markdown-сабагенты (`agents/*.md`), поиск hooks.json только в корне,
«пустой mcpServers = skipped». Срезайте ANSI; `TERM=dumb`.

## Источник 4 — живые установки

```bash
ls ~/.gemini/config/plugins/          # плагины самого Google = конвенции
cat ~/.gemini/config/plugins/flutter/plugin.json   # {"name":"flutter"} — минимальный мир
```

Плагины Google доказали модель «двух миров» и вскрыли
`gemini-extension.json` (артефакт совместимости `agy plugin import gemini`,
по источнику 2).

## Воспроизводимый пайплайн (после любого обновления Antigravity)

1. `agy update` — зафиксировать реальную версию.
2. Продиффать встроенные доки со своим снапшотом (источник 1).
3. Передампить три бинарника; прогнать чеклист grep'ов: имена событий,
   ключи `injectSteps`, `installed_version`, `decision`/`allow_tool`,
   marketplace, любые новые существительные-компоненты; сравнить счётчики
   со старыми дампами.
4. Перегнать пробы валидатором: свой payload, эталонный, пробный с
   экзотикой — следить за новыми строками в выводе.
5. `npm test` в этом репозитории — dogfood- и agy-validate-наборы
   закрепляют ожидаемое состояние и падают при дрейфе.
6. Обновить [internals.md](../internals.md) с новыми датами, перекалибровать
   линтер, явно записать опровергнутые слухи.

Либо, с установленным плагином: `/meta-scout` — сабагент прогоняет этот
плейбук и репортит дрейф с провенансом.

## Этика и рамки

Всё выше — чтение бинарников и конфигов, уже установленных на вашей
машине, ради интероперабельности: без сетевых зондирований, без кредов,
без обхода защит. Уважайте условия preview; настоящие баги репортите
Google, а не полагайтесь на них.

*См. также: [реестр ловушек](../internals.md) ·
[Работа с плагином](using-the-plugin.ru.md)*
