.PHONY: up up-deps down test test-backend test-web build clean logs psql demo demo-banner where-is set-password rename-user list-users backup update

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

## tools/where-is: search MODULE_MAP for feature file paths
## Usage: make where-is feat="order drawer"
where-is:
	@tools/where-is $(feat)

## list-users: print all admin/worker accounts in the database
list-users:
	@docker compose exec -T postgres psql -U $${POSTGRES_USER:-drshoes} -d $${POSTGRES_DB:-drshoes} -c \
		"SELECT email, full_name, role, active FROM user_ ORDER BY role DESC, email;"

## set-password: change password for an existing user.
## Usage: make set-password EMAIL=admin@example.com PASSWORD='NoweHaslo123!'
set-password:
	@test -n "$(EMAIL)" || (echo "ERROR: pass EMAIL=foo@bar.pl"; exit 1)
	@test -n "$(PASSWORD)" || (echo "ERROR: pass PASSWORD='...'"; exit 1)
	@docker compose exec -T postgres psql -U $${POSTGRES_USER:-drshoes} -d $${POSTGRES_DB:-drshoes} -v ON_ERROR_STOP=1 \
		-c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" \
		-c "UPDATE user_ SET password_hash = crypt('$(PASSWORD)', gen_salt('bf', 12)), updated_at = now() WHERE email = '$(EMAIL)';" \
		-c "SELECT email, full_name, role, updated_at FROM user_ WHERE email = '$(EMAIL)';"

## backup: create a gzipped pg_dump snapshot under ./backups/.
## Usage: make backup
backup:
	@mkdir -p backups
	@FILE="backups/backup-$$(date +%Y-%m-%d-%H%M%S).sql.gz" && \
		docker compose exec -T postgres pg_dump -U $${POSTGRES_USER:-drshoes} $${POSTGRES_DB:-drshoes} | gzip > "$$FILE" && \
		echo "Backup: $$FILE ($$(du -h "$$FILE" | cut -f1))"

## update: safe upgrade — backup DB, git pull, rebuild, restart.
## Usage: make update
update:
	@$(MAKE) backup
	@echo "Pulling latest code..."
	@git pull --ff-only origin main
	@echo "Rebuilding backend + web..."
	@docker compose build backend web
	@$(MAKE) up
	@echo "✅ Aplikacja zaktualizowana. Sprawdź http://localhost:3000/admin/login"

## rename-user: change full_name (and optionally email) for an existing user.
## Usage: make rename-user EMAIL=misza@drshoes.pl NAME='Jan Kowalski'
##        make rename-user EMAIL=misza@drshoes.pl NAME='Jan Kowalski' NEW_EMAIL=jan@firma.pl
rename-user:
	@test -n "$(EMAIL)" || (echo "ERROR: pass EMAIL=foo@bar.pl"; exit 1)
	@test -n "$(NAME)" || (echo "ERROR: pass NAME='Imię Nazwisko'"; exit 1)
	@docker compose exec -T postgres psql -U $${POSTGRES_USER:-drshoes} -d $${POSTGRES_DB:-drshoes} -v ON_ERROR_STOP=1 \
		-c "UPDATE user_ SET full_name = '$(NAME)', email = COALESCE(NULLIF('$(NEW_EMAIL)', ''), email), updated_at = now() WHERE email = '$(EMAIL)';" \
		-c "SELECT email, full_name, role FROM user_ WHERE email = COALESCE(NULLIF('$(NEW_EMAIL)', ''), '$(EMAIL)');"
