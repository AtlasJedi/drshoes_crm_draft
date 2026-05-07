.PHONY: up up-deps down test test-backend test-web build clean logs psql

up-deps:
	docker compose up -d postgres minio minio-init

up:
	docker compose up -d --build

down:
	docker compose down

clean:
	docker compose down -v

logs:
	docker compose logs -f --tail=200

test-backend:
	cd backend && mvn -B verify

test-web:
	pnpm -r test

test: test-backend test-web

build:
	cd backend && mvn -B -DskipTests package
	pnpm -r build

psql:
	docker compose exec postgres psql -U $${POSTGRES_USER:-drshoes} -d $${POSTGRES_DB:-drshoes}
