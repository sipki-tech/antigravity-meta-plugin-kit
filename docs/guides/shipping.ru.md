# Релиз: дистрибуция, обновления, маркетплейсы, релизные гейты

*[English](shipping.md) | Русский*

## Нативная дистрибуция через `agy plugin install`

Ни npm publish, ни инсталлера везти не нужно. Пользователи ставят прямо с
GitHub через Antigravity CLI:

```bash
agy plugin install https://github.com/you/my-plugin   # клон, регистрация, установка
```

CLI клонирует репозиторий, сканирует его на корневую папку `plugins/`
(«bulk plugins directory»), копирует каждый плагин в
`~/.gemini/config/plugins/<name>/` и регистрирует установку в
`~/.gemini/config/import_manifest.json`. Скажите пользователям перезапустить
Antigravity после. Локальный чекаут ставится так же:

```bash
agy plugin install path/to/my-plugin                  # локальная payload-папка
```

С CLI 1.0.9 `agy plugin install` также резолвит git-сабмодули. Короткие формы
вроде `github:you/repo` или `you/repo` **отклоняются** — передавайте полный
URL `https://github.com/...` или путь к директории.

## Паттерн update

Отдельного подкоманды `agy plugin update` **нет**. **Update = повторный
install** — он заново клонирует последний `main` и перерегистрирует:

```bash
agy plugin install https://github.com/you/my-plugin
```

Поскольку CLI не пишет version-файл, печатать diff версий нечего; ссылайтесь
на CHANGELOG, чтобы пользователи видели, что изменилось. Учтите, что
переустановка Antigravity может стереть сторонние папки из
`~/.gemini/config/plugins/`, поэтому рекомендуйте привычку `agy plugin list`
после апдейта и переустановку, если плагин пропал (см.
[internals](../internals.md)).

## enable / disable / uninstall

- **`agy plugin list`** — показывает установленные через CLI плагины; самое
  быстрое подтверждение, что установка зарегистрировалась.
- **`agy plugin enable|disable <name>`** — переключить плагин, не удаляя его.
- **`agy plugin uninstall <name>`** — удаляет папку плагина и его запись в
  `import_manifest.json`.

Отдельной команды verify нет: `agy plugin validate <payload>` проверяет
структуру, а `agy plugin list` (плюс живая сессия, видящая скиллы)
подтверждает установку.

## Релизные гейты (по порядку)

1. `lint` — ноль FAIL, ноль warnings на вашем payload.
2. `agy plugin validate plugins/<name>` — `[ok]`, hooks processed.
3. `npm test` — зелёный локально.
4. Зелёный CI: матрица ubuntu+macos × Node 20/22, `npm test` + структурный
   шаг (`agy plugin validate`, когда `agy` есть на PATH).
5. Проверка чистой машины: `agy plugin install https://github.com/you/my-plugin`
   из чистого окружения → `agy plugin list` его показывает → сессия видит его
   скиллы → `agy plugin uninstall <name>` чисто удаляет.
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

- Тег до CI → сломанный тег уедет следующим `agy plugin install`.
- Payload с закоммиченным `installed_version.json` → это артефакт времени
  установки, а не файл payload; линт предупреждает.
- Сказать пользователям «обновитесь», не перезапустив `agy plugin install` →
  ничего не изменится; фонового авто-апдейта нет.

## Чеклист

- [ ] README документирует `agy plugin install` и апдейт через переустановку
- [ ] `agy plugin list` / `uninstall` проверены на чистой машине
- [ ] CI-матрица + `agy plugin validate` зелёные; тег только после
- [ ] запись в CHANGELOG + Backlog для отложенных идей
- [ ] EN/RU доки в одном коммите

*См. также: [Быстрый старт](getting-started.ru.md) ·
[Тестирование](testing.ru.md)*
