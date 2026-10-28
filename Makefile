install:
	npm ci

build:
	rm -rf dist
	npm run build

start:
	make start-backend

start-backend:
	npx start-server -s ./dist

start-frontend:
	npm run dev

develop:
	make start-backend & make start-frontend

test:
	npm run --silent test

lint:
	npm run --silent lint
	npm run --silent format:check

lint-fix:
	npm run --silent lint:fix

# Translation keys are pulled out of the code: src/locales/ru/translation.json
# is not maintained by hand, only the values under the extracted keys are.
i18n-extract:
	npx i18next-cli extract

# Which locales lag behind ru.
i18n-status:
	npx i18next-cli status

.PHONY: install build start start-backend start-frontend develop test lint lint-fix i18n-extract i18n-status
