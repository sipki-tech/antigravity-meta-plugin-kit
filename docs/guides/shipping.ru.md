# Релиз: дистрибуция, обновления, маркетплейсы, релизные гейты

*[English](shipping.md) | Русский*

## GitHub-only дистрибуция через npx

npm publish не нужен. Пользователи запускают:

```bash
npx github:you/my-plugin install            # кэшированный чекаут
npx github:you/my-plugin#main install       # форсировать последний коммит
```

Две ловушки упаковки (обе закрыты скаффолдом этого кита):

- `npx github:` ставит через `npm pack`, который **молча выбрасывает файлы
  с именем `.gitignore`** и по-особому трактует вложенные `package.json`.
  Если ваш репозиторий шаблонизирует такие файлы — храните их под
  безопасными именами (`_gitignore`) и переименовывайте при генерации.
- npx **кэширует** чекаут — задокументируйте `#main` в README, иначе
  пользователи будут дебажить версию, которую вы уже починили.

С CLI 1.0.9 `agy plugin install` также резолвит git-сабмодули.

## Паттерн update

`update` = повторный install, затем отчёт. Сравните версию в установленном
`installed_version.json` с `plugin.json` из payload:

- не был установлен → «fresh install (x.y.z)»
- равны → «already up to date (x.y.z) — payload re-synced»
- различаются → «updated: a.b.c -> x.y.z» + ссылка на CHANGELOG

## Контракты verify / uninstall

- **verify** — именованные чеки `{name, pass, note}`, печать
  `ok /FAIL name (note)`, exit 1 при любом провале. Минимум: папка плагина,
  манифест парсится, author — объект, `installed_version.json` есть и
  совпадает, корневой hooks.json объявляет именованный хук, скрипты хуков
  на месте.
- **uninstall** — удалить папки плагина (и зеркала); prune **только** тех
  MCP-записей, что идентичны установленным; правки пользователя остаются.

## Релизные гейты (по порядку)

1. `lint` — ноль FAIL, ноль warnings на вашем payload.
2. `agy plugin validate plugins/<name>` — `[ok]`, hooks processed.
3. `npm test` — зелёный локально.
4. Зелёный CI: матрица ubuntu+macos × Node 20/22, `npm test` + smoke-job
   (установка во временный воркспейс → verify).
5. Проверка чистой машины: `npx github:you/my-plugin#main install --dry-run`
   из чистой временной папки (заодно доказывает обходы packlist).
6. Тег — **после** зелёного CI, никогда до. Release notes = секция
   CHANGELOG.

## Версии и доки

- SemVer + [Keep a Changelog](https://keepachangelog.com). Идеи вне скоупа —
  в подсекцию `Backlog`, а не полу-отгрузкой.
- Двуязычные доки меняются в одном коммите, секция к секции, — или никак.

## Другие каналы дистрибуции

- **Маркетплейсы**: `agy plugin install plugin@marketplace`;
  `agy plugin link <marketplace> <target>` подключает свой.
- **Миграция из Claude Code**: направляйте пользователей на
  `agy plugin import claude` — Antigravity импортирует плагины Claude Code
  (папка `commands/` при заглатывании конвертируется в скиллы).
- Состоянием управляют через `agy plugin enable|disable <name>`.

## Подводные камни

- Тег до CI → сломанный тег навсегда кэшируется npx.
- Payload с закоммиченным `installed_version.json` → инсталлер и файл
  дерутся; линт предупреждает.
- Починили баг и сказали пользователям перезапустить npx без `#main` → они
  получат кэшированную сломанную версию.

## Чеклист

- [ ] README документирует `#main` и команду update
- [ ] verify/uninstall соблюдают контракты выше
- [ ] CI-матрица + smoke зелёные; тег только после
- [ ] запись в CHANGELOG + Backlog для отложенных идей
- [ ] EN/RU доки в одном коммите

*См. также: [Быстрый старт](getting-started.ru.md) ·
[Тестирование](testing.ru.md)*
