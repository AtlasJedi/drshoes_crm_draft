.PHONY: up up-deps down test test-backend test-web build clean logs psql demo demo-banner

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

demo: ## One-command demo boot: postgres + minio + jaeger + backend + web, seeded, prints banner
	DRSHOES_DEMO_SEED_ENABLED=true docker compose up -d --build
	@echo "Waiting for backend health..."
	@until curl -fs http://localhost:8080/actuator/health > /dev/null 2>&1; do sleep 2; done
	@echo "Waiting for web..."
	@until curl -fs http://localhost:3000 > /dev/null 2>&1; do sleep 2; done
	@$(MAKE) demo-banner

demo-banner: ## Print the demo access banner
	@printf "\n\033[1;32m✅ Dr Shoes demo gotowy\033[0m\n"
	@printf "   Admin URL:  \033[1;36mhttp://localhost:3000/admin/login\033[0m\n"
	@printf "   Login:      \033[1;36mmisza@drshoes.pl\033[0m\n"
	@printf "   Hasło:      \033[1;36mchange-me-on-first-login\033[0m\n"
	@printf "   Jaeger UI:  \033[1;36mhttp://localhost:16686\033[0m\n"
	@printf "   MinIO:      \033[1;36mhttp://localhost:9001\033[0m  (drshoes / drshoes-dev-secret)\n\n"
