# Схема репозитория и зависимостей

Ниже кратко описана структура репозитория, зависимости между пакетами, и как устроены CI / релизные пайплайны.

**Корневая структура**

- `package.json` — корневой манифест, содержит `workspaces`:
  - `shared/*`
  - `npm-package`
- `README.md`
- `turbo.json` — конфигурация Turborepo / turbo
- `scripts/clean.js` — скрипт очистки (вызывается в prebuilds)
- `npm-package/` — основной публикуемый npm-пакет
  - `package.json` — имя, версия, `prepare`/`build`, `files`, `publishConfig`
  - `src/index.ts` — исходники
  - `dist/` — результат сборки (в `files` указана именно `dist`)
- `shared/`
  - `a/` — пакет `@repo/a` (private workspace)
    - `package.json` — `name: "@repo/a"` `version: 1.0.0`
    - `src/index.ts`
  - `b/` — пакет `@repo/b` (private workspace)
    - `package.json` — `name: "@repo/b"` `version: 1.0.0`
    - `src/B.ts`
  - `c/` — пакет `@repo/c` (private workspace)
    - `package.json` — `name: "@repo/c"` `version: 1.0.0`

**Ключевые зависимости между пакетами**
- `npm-package` импортирует `@repo/b` (в `src/index.ts`) — прямой зависимый пакет.
- `@repo/b` импортирует `@repo/a` (в `shared/b/src/B.ts` импорт `A`) — транзитивная зависимость.
- Итого: `npm-package` -> `@repo/b` -> `@repo/a`.
- `shared/c` присутствует как отдельный workspace, но в текущих исходниках не видно прямого импорта в `npm-package`.

**Скрипты сборки**
- В `npm-package/package.json`:
  - `prebuild` — `node ../scripts/clean.js`
  - `build` — `npx esbuild src/index.ts --bundle --platform=node --format=esm --outfile=./dist/npm-package-index.js`
  - `prepare` — `npm run build` (используется при публикации)
- В корне `package.json`:
  - `clean` — `node ./scripts/clean.js`
  - `build` — `npm run clean && turbo run build --force` (собирает весь монорепо)

CI / Release / Publish (как настроено сейчас)

**Workflows (в `.github/workflows/`)**
- `publish-npm-package.yml` — публикует только `npm-package`.
  - Триггеры: `release: published`, `push` на `main`, `workflow_dispatch` (можно указать `publish=true` при ручном запуске).
  - Шаги: checkout (fetch-depth: 0), install (`npm ci` в корне), `npm run build` (сборка всех пакетов), детекция изменений, `npm pack --dry-run` (preview), `npm publish` в директории `npm-package`.
  - Детекция изменений: вычисляет изменённые файлы между базой и HEAD и помечает `should_publish=true`, если:
    - изменилось что-то в `npm-package/**`, или
    - изменились `shared/<pkg>/**`, и `npm-package` импортирует этот `pkg` (ищет по имени пакета в `shared/*/package.json`).
  - Для публикации используется `NODE_AUTH_TOKEN` взятый из `secrets.NPM_TOKEN`.

- `release-please.yml` — автоматизация создания релизов (added):
  - Использует `google-github-actions/release-please-action@v3` в режиме `monorepo`.
  - На пуш в `main` анализирует коммиты/PR и создаёт релизы (bump версии и changelogs) автоматически.
  - После создания релиза срабатывает `publish-npm-package.yml` по событию `release.published`.

**Требуемые secrets**
- `NPM_TOKEN` — токен npm для публикации пакета в npm registry. Должен быть добавлен в `Settings → Secrets → Actions`.
- `GITHUB_TOKEN` — автоматически доступен в workflows (используется release-please и semantic actions).

Как это работает в общем (flow)
1. Пуш в `main` (или merge PR). `release-please` анализирует коммиты/PR и создаёт релиз с changelog и тэгом.
2. `publish-npm-package.yml` запускается на событие `release.published` (и/или на push + детектор). Оно сначала собирает весь репо, затем проверяет, повлиял ли пуш на `npm-package` или на его импортируемые internal deps.
3. Если проверка пройдена, workflow выполняет `npm publish` только в `npm-package` (`working-directory: npm-package`) с `NODE_AUTH_TOKEN` из `secrets.NPM_TOKEN`.

Рекомендации и заметки
- Убедитесь, что `npm-package/package.json` содержит поле `files` (например `"files": ["dist"]`) и не помечен как `private: true` — иначе `npm publish` не пройдет.
- Используйте conventional commit / semantic commit messages (например `feat:`, `fix:`) или PR titles — это позволит `release-please` корректно определить bump (patch/minor/major) и сформировать changelog.
- Если хотите полностью автоматическое версионирование без PR-отворота, альтернативы: `semantic-release` (требует конфиг) или `changesets` (нужны changeset-файлы). Текущая схема с `release-please` + `publish` даёт автоматическую генерацию релизов и публикацию пакета.

Файлы для быстрой проверки
- `npm-package/package.json` — проверить `name`, `version`, `files`, `publishConfig`.
- `.github/workflows/publish-npm-package.yml` — логика публикации и детекции.
- `.github/workflows/release-please.yml` — автоматическое создание релизов.

Если нужно — могу:
- добавить `repo-str.md` дополнительно с диаграммой зависимостей (svg/mermaid) или авто-генерацией графа; 
- переключить на `lerna` (если настаиваешь на Lerna) и настроить `lerna publish` в CI; 
- вместо `release-please` включить `semantic-release` или `changesets` и настроить их.

Дата: 2025-11-23
