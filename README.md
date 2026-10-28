# Чат (Slack)

[![hexlet-check](https://github.com/TiltStable/frontend-project-12/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/TiltStable/frontend-project-12/actions)

Напишите real-time приложение на React, используя AJAX, REST, websockets, React (с хуками) + Zustand + TanStack Query + @mantine/form

Учебный проект Хекслета: https://ru.hexlet.io/programs/frontend
Как это должно работать: https://files.hexlet.app/a/ose685


## Стек

- React 19 (хуки) + Vite
- React Router (маршрутизация)
- Mantine (UI) + @mantine/form
- Zustand (стейт-менеджер, persist в localStorage)
- TanStack Query (загрузка и кеширование серверных данных)
- socket.io-client (real-time)
- @hexlet/chat-server (учебный бэкенд: REST API + websockets)
- @sentry/react + Bugsink (коллектор ошибок)
- Vitest, oxlint, oxfmt

## Установка

```bash
git clone https://github.com/TiltStable/frontend-project-12.git
cd frontend-project-12
make install
```

Требуется Node.js >= 22.12.0.

## Использование

```bash
# собрать фронтенд в dist
make build

# запустить сервер (раздаёт dist + API + websockets на :5001)
make start

# проверить сервер
curl http://localhost:5001/api/v1/channels

# запуск в разработке: бэкенд (:5001) + vite dev-сервер с прокси (:5002)
make develop

# тесты и линтер
make test
make lint
```

Сайт проекта: будет добавлен после деплоя.

## Мониторинг ошибок

Ошибки приложения собираются коллектором [Bugsink](https://www.bugsink.com/)
через Sentry-совместимый SDK `@sentry/react`.

DSN задаётся переменной окружения `VITE_SENTRY_DSN` (см. `.env.example`).
Vite вшивает её в бандл **на этапе сборки** (12factor: конфигурация в
окружении), поэтому:

- локально: скопируйте `.env.example` в `.env.local` и впишите DSN
  (`.env.local` не коммитится);
- на деплое: переменная должна быть в **build-окружении** (на Render —
  в Environment сервиса до первого билда; смена значения требует rebuild).

Если переменная не задана, сборка предупреждает об этом в логе, а
приложение работает без репортинга ошибок (в консоли браузера будет
предупреждение). Локально проверить сборщик можно, бросив необработанную
ошибку из DevTools-консоли: `setTimeout(() => { throw new Error("test") })`
— она появится как issue в проекте Bugsink.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
