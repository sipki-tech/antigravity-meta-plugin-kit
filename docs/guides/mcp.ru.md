# MCP-серверы

[English](mcp.md) | Русский

Плагин может поставлять один или несколько серверов Model Context Protocol (MCP)
через корневой файл `mcp_config.json`. Antigravity автоматически добавляет
пространство имён `<plugin>_<server>`, чтобы исключить конфликты между плагинами.

## Расположение и поддерживаемые транспорты

Размещайте конфиг строго по пути `<plugin>/mcp_config.json`. В отличие от
`plugin.json` и `hooks.json`, **`mcp_config.json` поддерживает JSONC**
(комментарии и висячие запятые).

Antigravity `1.5.17+` поддерживает **два** транспорта MCP в `mcp_config.json` —
**не** указывайте поля `"type"` или `"httpUrl"` в нативных конфигах плагинов:

### Stdio-серверы

Запускает локальный процесс поверх stdin/stdout. Предпочитайте `"command":
"node"` (со встроенным JS) или `"npx"` ради кроссплатформенности; если серверу
нужен сторонний рантайм (`python`, `uvx`, `docker`), поставляйте его с
`"disabled": true` и документируйте требования.

```jsonc
{
  "mcpServers": {
    "local-tools": {
      "command": "node",
      "args": ["${PLUGIN_ROOT}/scripts/mcp-server.mjs"],
      "env": {
        "STATE_DIR": "${PLUGIN_DATA}",
        "API_TOKEN": "${API_TOKEN}"
      },
      "variables": [
        {
          "name": "API_TOKEN",
          "title": "API Token",
          "description": "Personal access token for the service."
        }
      ]
    }
  }
}
```

### Streamable HTTP (никогда не legacy `/sse`)

Подключается к удалённому MCP-эндпоинту по Streamable HTTP через поле `url` (или
устаревший алиас `serverUrl`):

```jsonc
{
  "mcpServers": {
    "remote-api": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      },
      "variables": [
        {
          "name": "API_TOKEN",
          "title": "API Token"
        }
      ]
    }
  }
}
```

> **Ловушка старого `/sse`:** Antigravity **не поддерживает** legacy HTTP+SSE
> эндпоинты MCP. `agy plugin validate --strict` не предупреждает о `/sse`,
> поэтому их отлавливает `lint.mjs`. Если внешний сервер умеет только SSE,
> проксируйте его локально через `mcp-remote` поверх Stdio.

## Точная матрица подстановки переменных

Antigravity применяет строгие асимметричные правила подстановки — их нарушение
приводит к передаче буквальных строк `${...}` в рантайме:

| Плейсхолдер | Раскрывается в | **НЕ** раскрывается в | Примечания |
|---|---|---|---|
| `${PLUGIN_ROOT}`, `${PLUGIN_DATA}` | `args`, значения `env`, `cwd` | `command`, `url`, `headers`, `oauth` | Никогда не задавайте `PLUGIN_ROOT` как ключ `env` — Antigravity передаёт его автоматически. |
| `${VAR}` из серверного `variables[]` | `command`, `args`, `env`, `url`, `headers`, `oauth` | `cwd` | `variables[]` объявляется внутри объекта сервера, но не в корне `mcp_config.json` или `plugin.json`. Плагины с `variables` устанавливаются **выключенными**, пока пользователь не задаст значения. |
| `${env:NAME}` | *(нигде)* | везде | Переменные окружения ОС в `mcp_config.json` **не** подставляются. |

Никогда не храните реальные токены (`ghp_`, `github_pat_`, `sk-`, `AIza`,
`xoxb-`, `Bearer ...`) в `env` или `headers` — `lint.mjs` выдаёт warning на
захардкоженные секреты.

## Загрузка инструментов, `eager` и таймауты

- **Ленивая загрузка по умолчанию:** инструменты MCP-плагинов вызываются по
  запросу через `call_mcp_tool`, чтобы не раздувать контекст. Встроенный вывод
  ответа ограничен **10 КБ**, после чего сбрасывается в файл.
- **Тонкая настройка:** задавайте `"tools": { "<tool>": { "eager": true, "background": "off" } }`
  только для самых частых инструментов, которым нужно быть в верхнем списке.
  Важно: `background` обязан быть строкой (`"off"` или `"always"`) — булево
  `false` ломает JSON-парсер и полностью пропускает MCP-сервер.
- **Фильтрация:** используйте `"enabledTools": [...]` или `"disabledTools": [...]`,
  чтобы сузить крупный внешний сервер до нужного подмножества.
- **Таймауты:** `"timeoutSeconds"` задаёт таймаут вызова (`-1` отключает).

## MCP Apps (`SEP-1865`) и OAuth 2.1

- **MCP Apps (`SEP-1865`):** инструменты могут указывать `_meta.ui.resourceUri`
  на HTML-ресурс `ui://` для рендера в `com.google.antigravity/ui` (`aux_pane`,
  `global`, `file`). Так как CLI `agy` не рендерит iframe и игнорирует
  `_meta.ui.visibility`, **всегда возвращайте полноценный текстовый `content`**
  вместе с UI-ресурсом.
- **OAuth 2.1 / CIMD:** Antigravity поддерживает OAuth 2.1 + PKCE `S256` с
  Client ID Metadata Documents (`https://antigravity.google/oauth/mcp-client.json`)
  и динамической регистрацией клиентов. Добавьте в allowlist провайдера
  `https://antigravity.google/oauth-callback` (локальные CLI/App) и
  `https://antigravity.google.com/oauth/callback` (Marketplace) и проверяйте
  поток авторизации как в CLI, так и в App.

## Альтернатива: встроенный CLI + `auth.json` + скилл

Не каждой интеграции нужен постоянно запущенный процесс MCP. Собственные
Workspace-плагины Google (`gcalendar`, `gdocs`, `gdrive`, `gsheets`, `gslides`)
поставляют:

1. Самодостаточный CLI или Node-скрипт в `scripts/` (или `bin/`).
2. Декларативный `auth.json` (OAuth2 или API-ключ, управляемые Antigravity).
3. Компактный `SKILL.md`, обучающий агента точным командам и флагам.

Выбирайте **CLI + скилл** для stateless-команд с простыми флагами (генерируется
командой `meta-kit.mjs create my-plugin --minimal --with-cli`, а `auth.json`
проверяется через `lint.mjs --strict`, так как `agy plugin validate` сейчас
пропускает `auth.json`); выбирайте **MCP**, когда нужны постоянное соединение,
строгие JSON-схемы инструментов, ресурсы или интерфейс MCP Apps.

Далее: [Манифест и раскладки](plugin-manifest.ru.md) · [Скиллы](skills.ru.md) · [Внутренности](../internals.md)
