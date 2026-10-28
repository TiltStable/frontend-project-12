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

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
