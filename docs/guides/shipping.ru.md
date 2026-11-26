# Релиз плагинов

[English](shipping.md) | Русский

Поставляйте чистые плагины Google Antigravity без единого предупреждения через
GitHub, локальные директории, репозитории команд или собственные маркетплейсы.

## Нативные каналы установки

Пользователи ставят нативные плагины Antigravity напрямую через `agy plugin
install` — без скриптов-обёрток и сторонних менеджеров пакетов:

```bash
# 1. Напрямую с GitHub (HTTPS)
agy plugin install https://github.com/<owner>/<repo>

# 2. Локальная папка во время разработки
agy plugin install ./plugins/my-plugin

# 3. Зарегистрированный маркетплейс
agy plugin install my-plugin@my-marketplace

# 4. Уровень проекта (внутри командного репозитория)
# Положите плагин в <project>/.agents/plugins/my-plugin/ и закоммитьте.
```

`agy plugin install` обновляет плагин атомарной заменой, отклоняет выходящие за
границы симлинки и FIFO и хранит статус включения в `~/.gemini/config/config.json`.

## Предрелизный чеклист

Перед созданием тега релиза проверьте каждый пункт:

- [ ] `npm test` проходит чисто на Node >= 20.
- [ ] `lint.mjs --strict .` завершается с кодом `0`, 0 ошибок и 0 предупреждений.
- [ ] `agy plugin validate --strict --json plugins/<name>` завершается с кодом
      `0` и `"findings": []`.
- [ ] `plugin.json` — строгий JSON (без комментариев JSONC и висячих запятых),
      валидный SemVer `version`, строгий kebab-case `name`, ноль неизвестных полей.
- [ ] `logo` указывает на реальный квадратный файл (`>=128×128`, ~10%
      прозрачных полей, не внутри папки с точкой).
- [ ] Ноль захардкоженных секретов в `mcp_config.json`, скриптах и тестах.
- [ ] Нет навязчивых глобальных `Stop`-хуков и раздутых always-on правил
      (>150 строк), мешающих чужим воркспейсам.
- [ ] Пройдена живая проверка в изолированном `/tmp` через `agy -p ... --add-dir`.

## Требования Antigravity Marketplace

Если вы готовите плагин к публикации в Antigravity Marketplace:

- **`name`:** глобально уникальное имя в нижнем kebab-case.
- **`displayName`:** краткое название без ведущего префикса `"Antigravity"`.
- **`version`:** строгий SemVer (`MAJOR.MINOR.PATCH`).
- **`description`:** 1–2 чётких предложения (120–160 символов).
- **`logo`:** квадратный `.svg`/`.png`/`.webp` (`>=128×128`, поля ~10%) по
  относительному пути вне папок с точкой или `https://` URL на домене Google.
- **`suggestedPrompts`:** до **3** полезных стартовых промптов.
- **`homepage` и `repository`:** валидные `https://` URL.
- **Ноль предупреждений и заметок:** `agy plugin validate --strict --json
  plugins/<name>` должен вернуть `"findings": []`.

## Публикация через `marketplace.json`

Для распространения нескольких плагинов через собственный каталог создайте
`marketplace.json`, где каждое поле `plugins[i].source` — это **объект
`archive` с `https://` URL и 64-символьным hex-дайджестом `sha256`** (никогда
не строка, `"git"` или `"github"` — `agy 1.5.17` их отклоняет):

```json
{
  "name": "acme-marketplace",
  "plugins": [
    {
      "name": "my-plugin",
      "version": "1.0.0",
      "description": "One-sentence summary.",
      "source": {
        "type": "archive",
        "url": "https://github.com/acme/my-plugin/archive/refs/tags/v1.0.0.tar.gz",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    }
  ]
}
```

Проверьте сам каталог офлайн (в CI) и через `agy`:

```bash
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs lint --strict marketplace.json
agy plugin validate --strict --json marketplace.json
```

## Офлайн-CI в GitHub Actions

На стандартных раннерах GitHub Actions нет установленного `agy`. Держите CI
быстрым и строгим, запуская `npm test` и офлайн `lint.mjs --strict`, а `agy
plugin validate --strict --json` — локально и на self-hosted раннерах:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "22"
- run: npm test
- name: Офлайн строгий линт через antigravity-meta-plugin-kit
  run: |
    git clone --depth 1 https://github.com/sipki-tech/antigravity-meta-plugin-kit /tmp/meta-kit
    node /tmp/meta-kit/plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs lint --strict .
```

Каждый репозиторий из `create.mjs` уже включает готовый
`.github/workflows/ci.yml` для Node 20 и 22 на Ubuntu и macOS.

## Версионирование и обновления

- Поднимайте `version` в `plugin.json` (и `package.json`, если он есть) по
  SemVer (`MAJOR.MINOR.PATCH`) и ставьте аннотированный git-тег (`v1.0.0`).
- Пользователи обновляются повторным запуском `agy plugin install
  https://github.com/<owner>/<repo>` (Antigravity атомарно заменяет файлы,
  сохраняя состояние включения и `PLUGIN_DATA`).

Далее: [Тестирование](testing.ru.md) · [Манифест и раскладки](plugin-manifest.ru.md) · [Исследование Antigravity](researching-antigravity.ru.md)
