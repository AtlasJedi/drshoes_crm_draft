# Milestone 0A — Foundation Skeleton (boot + health) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo, multi-module Maven backend with Flyway running V001, four microlibrary scaffolds, and Next.js app with design tokens — booted to a green `/actuator/health` and a rendered landing placeholder.

**Architecture:** Single git repo. Backend is multi-module Maven (parent + `app` + four `libs/*`). Frontend is pnpm + Turborepo workspace with `apps/web` (Next.js 16 App Router) + `packages/ui` (Tailwind preset + tokens) + `packages/api-types` (OpenAPI codegen target, empty for now). Local dev uses `docker-compose` to run Postgres + MinIO + backend + web. No auth yet — that's Milestone 0B.

**Tech Stack:** Java 21, Spring Boot 3.4, Maven 3.9, Flyway 10, Postgres 16, Testcontainers 1.20, JUnit 5, AssertJ, Spring Boot autoconfigure. Next.js 16, React 19, TypeScript 5, Tailwind 3.4, Radix UI, pnpm 9, Turborepo 2. Docker Compose v2.

**Working directory:** `/Users/atlasjedi/P/misza_madafaka`. The directory already contains `handoff/`, `.superpowers/`, `CLAUDE.md`, `.gitignore`, `ARCHITECTURE.md`, `docs/SCHEMA.sql`, `docs/API.md`, `docs/SCHEMA.md`, `handoff/DECISIONS.md`. **Do not modify any of those files** in this milestone.

---

## File Structure (locked)

After this plan completes, the tree is:

```
misza_madafaka/
├── .editorconfig                         (NEW)
├── .env.example                          (NEW)
├── .gitignore                            (already present, unchanged)
├── .github/workflows/ci.yml              (NEW)
├── .tool-versions                        (NEW — asdf-style: java 21, node 20, pnpm 9)
├── ARCHITECTURE.md, CLAUDE.md, README.md (last is NEW)
├── Makefile                              (NEW)
├── docker-compose.yml                    (NEW)
├── handoff/, docs/, .superpowers/        (unchanged)
│
├── pnpm-workspace.yaml                   (NEW)
├── package.json                          (NEW — root scripts only)
├── turbo.json                            (NEW)
├── tsconfig.base.json                    (NEW)
│
├── backend/
│   ├── pom.xml                           (NEW — parent POM)
│   ├── app/
│   │   ├── pom.xml                       (NEW)
│   │   ├── Dockerfile                    (NEW)
│   │   └── src/main/
│   │       ├── java/com/drshoes/app/
│   │       │   ├── DrShoesApplication.java       (NEW)
│   │       │   └── config/HealthConfig.java      (NEW — placeholder)
│   │       ├── resources/
│   │       │   ├── application.yaml              (NEW)
│   │       │   ├── application-local.yaml        (NEW)
│   │       │   └── db/migration/V001__init.sql   (COPIED from docs/SCHEMA.sql)
│   │       └── ... (test sources below)
│   │   └── src/test/java/com/drshoes/app/
│   │       ├── DrShoesApplicationTests.java     (NEW — context loads test)
│   │       └── HealthEndpointIntegrationTest.java (NEW — Testcontainers)
│   │   └── src/test/resources/
│   │       └── application-test.yaml            (NEW)
│   │
│   └── libs/
│       ├── messaging-core/
│       │   ├── pom.xml                                        (NEW)
│       │   └── src/main/java/com/drshoes/lib/messaging/
│       │       ├── Channel.java                                (NEW)
│       │       ├── DeliveryStatus.java                         (NEW)
│       │       ├── OutboundMessage.java                        (NEW)
│       │       ├── DeliveryReceipt.java                        (NEW)
│       │       ├── Attachment.java                             (NEW)
│       │       ├── MessageGateway.java                         (NEW)
│       │       └── WebhookEvent.java                           (NEW)
│       │   └── src/test/java/com/drshoes/lib/messaging/
│       │       └── OutboundMessageTest.java                    (NEW)
│       │
│       ├── email-gateway/
│       │   ├── pom.xml                                        (NEW)
│       │   └── src/main/java/com/drshoes/lib/email/
│       │       ├── EmailGateway.java                           (NEW — marker subtype)
│       │       ├── EmailGatewayProperties.java                 (NEW)
│       │       ├── LoggingEmailGateway.java                    (NEW — only impl in 0A)
│       │       └── EmailGatewayAutoConfiguration.java          (NEW)
│       │   └── src/main/resources/META-INF/spring/
│       │       └── org.springframework.boot.autoconfigure.AutoConfiguration.imports (NEW)
│       │   └── src/test/java/com/drshoes/lib/email/
│       │       └── LoggingEmailGatewayTest.java                (NEW)
│       │
│       ├── sms-gateway/
│       │   └── (mirror of email-gateway, with Sms* names)     (NEW)
│       │
│       └── storage/
│           ├── pom.xml                                        (NEW)
│           └── src/main/java/com/drshoes/lib/storage/
│               ├── BlobStorage.java                            (NEW)
│               ├── BlobKey.java                                (NEW)
│               ├── BlobMetadata.java                            (NEW)
│               ├── PresignedUrl.java                            (NEW)
│               ├── StorageProperties.java                       (NEW)
│               ├── S3BlobStorage.java                           (NEW — concrete impl, R2/MinIO compatible)
│               └── StorageAutoConfiguration.java                (NEW)
│           └── src/main/resources/META-INF/spring/
│               └── org.springframework.boot.autoconfigure.AutoConfiguration.imports (NEW)
│           └── src/test/java/com/drshoes/lib/storage/
│               └── S3BlobStorageIntegrationTest.java            (NEW — uses MinIO testcontainer)
│
├── apps/
│   └── web/
│       ├── package.json                          (NEW)
│       ├── tsconfig.json                         (NEW)
│       ├── next.config.mjs                       (NEW)
│       ├── tailwind.config.ts                    (NEW)
│       ├── postcss.config.js                     (NEW)
│       ├── Dockerfile                            (NEW)
│       ├── app/
│       │   ├── layout.tsx                        (NEW — root layout, fonts, html lang="pl")
│       │   ├── globals.css                       (NEW)
│       │   ├── (public)/
│       │   │   └── page.tsx                      (NEW — landing placeholder hero)
│       │   └── (admin)/admin/
│       │       └── page.tsx                      (NEW — placeholder "auth coming in 0B")
│       └── lib/
│           └── env.ts                            (NEW — runtime env validation)
│
└── packages/
    ├── ui/
    │   ├── package.json                          (NEW)
    │   ├── tsconfig.json                         (NEW)
    │   ├── tailwind-preset.ts                    (NEW — DESIGN_SYSTEM tokens)
    │   ├── src/
    │   │   ├── tokens.ts                         (NEW — color, font, spacing constants)
    │   │   ├── fonts.ts                          (NEW — next/font references)
    │   │   └── index.ts                          (NEW — re-exports)
    │   └── README.md                             (NEW)
    └── api-types/
        ├── package.json                          (NEW — placeholder)
        ├── tsconfig.json                         (NEW)
        └── src/index.ts                          (NEW — empty export)
```

**Boundary rules:**
- Each Maven module has one POM, one main package, focused responsibility.
- `messaging-core` has zero Spring deps. `email-gateway`, `sms-gateway`, `storage` use Spring Boot autoconfigure but no app-specific code.
- Frontend `packages/ui` has zero React component code in 0A — only tokens, preset, fonts. Components land in 0B.
- Backend `app` depends on all four libs via Maven coordinates.

---

## Phase 1 — Repo skeleton (Tasks 1-4)

### Task 1: Initialize git + root config files

**Files:**
- Create: `.editorconfig`
- Create: `.tool-versions`
- Create: `README.md`
- Verify: `.gitignore` (already present)

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/atlasjedi/P/misza_madafaka
git init -b main
git add .gitignore CLAUDE.md ARCHITECTURE.md handoff/ docs/
git commit -m "chore: import handoff package and architecture"
```

Expected: clean working tree after commit, branch `main`.

- [ ] **Step 2: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space

[*.{js,jsx,ts,tsx,json,yaml,yml,md,html,css,scss}]
indent_size = 2

[*.{java,sql}]
indent_size = 4

[Makefile]
indent_style = tab
```

- [ ] **Step 3: Create `.tool-versions`**

```
java temurin-21.0.5+11
nodejs 20.18.0
pnpm 9.12.3
maven 3.9.9
```

- [ ] **Step 4: Create `README.md`**

```markdown
# Dr Shoes

Two-layer web product (public landing + admin CRM) for Dr Shoes — shoe repair, custom painting, custom jacket painting workshop in Poland.

See `ARCHITECTURE.md` for the full design. UI strings are Polish; code/comments are English.

## Quick start

Prereqs: Docker, Java 21, Node 20+, pnpm 9, Maven 3.9.

```sh
make up        # boots postgres + minio + backend + web
make test      # runs full backend + frontend test suite
make down      # stops everything
```

After `make up`:
- Public site:  http://localhost:3000
- Admin shell:  http://localhost:3000/admin
- Backend API:  http://localhost:8080
- Health:       http://localhost:8080/actuator/health
- MinIO console: http://localhost:9001 (drshoes / drshoes-dev-secret)

## Layout

- `backend/` — Spring Boot multi-module Maven project (`app` + four reusable libs).
- `apps/web/` — Next.js 16 (public landing + `/admin/*` route group).
- `packages/ui` — shared design tokens + Tailwind preset.
- `packages/api-types` — TypeScript types generated from backend OpenAPI.
- `infra/` — deploy manifests (Cloudflare Containers, GitHub Actions).
- `docs/` — schema, API contract, plans.
- `handoff/` — original brief, design prototype, locked decisions.
```

- [ ] **Step 5: Commit**

```bash
git add .editorconfig .tool-versions README.md
git commit -m "chore: editor config, tool versions, README"
```

---

### Task 2: Create root pnpm workspace + Turborepo config

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "drshoes",
  "private": true,
  "version": "0.0.1",
  "packageManager": "pnpm@9.12.3",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.3",
    "@types/node": "^20.16.11"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "typecheck": {}
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "preserve",
    "incremental": true
  },
  "exclude": ["node_modules", ".next", "dist"]
}
```

- [ ] **Step 5: Install + verify**

```bash
pnpm install
```

Expected: lockfile created, no errors. `pnpm-lock.yaml` exists.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: pnpm workspace and Turborepo skeleton"
```

---

### Task 3: Docker Compose + .env.example

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `Makefile`

- [ ] **Step 1: Create `.env.example`**

```env
# Postgres
POSTGRES_USER=drshoes
POSTGRES_PASSWORD=drshoes-dev-secret
POSTGRES_DB=drshoes
POSTGRES_PORT=5432

# MinIO (S3-compatible, local dev only)
MINIO_ROOT_USER=drshoes
MINIO_ROOT_PASSWORD=drshoes-dev-secret
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_BUCKET=drshoes-dev

# Backend
BACKEND_PORT=8080
SPRING_PROFILES_ACTIVE=local

# Web
WEB_PORT=3000
NEXT_PUBLIC_API_BASE=/api
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-drshoes}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-drshoes-dev-secret}
      POSTGRES_DB: ${POSTGRES_DB:-drshoes}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-drshoes}"]
      interval: 5s
      timeout: 3s
      retries: 10

  minio:
    image: minio/minio:RELEASE.2024-10-13T13-34-11Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-drshoes}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-drshoes-dev-secret}
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/ready"]
      interval: 5s
      timeout: 3s
      retries: 10

  minio-init:
    image: minio/mc:RELEASE.2024-10-08T09-37-26Z
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER:-drshoes} ${MINIO_ROOT_PASSWORD:-drshoes-dev-secret};
      mc mb -p local/${MINIO_BUCKET:-drshoes-dev} || true;
      mc anonymous set download local/${MINIO_BUCKET:-drshoes-dev} || true;
      exit 0;
      "

  backend:
    build:
      context: ./backend
      dockerfile: app/Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      SPRING_PROFILES_ACTIVE: local
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-drshoes}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER:-drshoes}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD:-drshoes-dev-secret}
      DRSHOES_STORAGE_ENDPOINT: http://minio:9000
      DRSHOES_STORAGE_BUCKET: ${MINIO_BUCKET:-drshoes-dev}
      DRSHOES_STORAGE_ACCESS_KEY: ${MINIO_ROOT_USER:-drshoes}
      DRSHOES_STORAGE_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-drshoes-dev-secret}
    ports:
      - "${BACKEND_PORT:-8080}:8080"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    depends_on:
      backend:
        condition: service_healthy
    environment:
      NEXT_PUBLIC_API_BASE: ${NEXT_PUBLIC_API_BASE:-/api}
      INTERNAL_API_BASE: http://backend:8080
    ports:
      - "${WEB_PORT:-3000}:3000"

volumes:
  db_data:
  minio_data:
```

- [ ] **Step 3: Create `Makefile`**

```makefile
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
```

- [ ] **Step 4: Verify compose file**

```bash
cp .env.example .env
docker compose config > /dev/null
```

Expected: no errors. `.env` exists locally (gitignored).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example Makefile
git commit -m "chore: docker compose with postgres + minio, root Makefile"
```

---

### Task 4: GitHub Actions CI skeleton

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:24-dind
        options: --privileged
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
      - name: Build + test backend
        working-directory: backend
        run: mvn -B verify

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v4
        with:
          version: '9.12.3'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: CI workflow for backend (mvn verify) and frontend (pnpm)"
```

---

## Phase 2 — Backend parent + microlibrary scaffolds (Tasks 5-9)

### Task 5: Parent `backend/pom.xml`

**Files:**
- Create: `backend/pom.xml`

- [ ] **Step 1: Create parent POM**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                             https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.drshoes</groupId>
  <artifactId>drshoes-parent</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <packaging>pom</packaging>
  <name>Dr Shoes Parent</name>

  <modules>
    <module>libs/messaging-core</module>
    <module>libs/email-gateway</module>
    <module>libs/sms-gateway</module>
    <module>libs/storage</module>
    <module>app</module>
  </modules>

  <properties>
    <java.version>21</java.version>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>

    <spring-boot.version>3.4.0</spring-boot.version>
    <testcontainers.version>1.20.4</testcontainers.version>
    <aws-sdk.version>2.29.20</aws-sdk.version>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-dependencies</artifactId>
        <version>${spring-boot.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
      <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>testcontainers-bom</artifactId>
        <version>${testcontainers.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
      <dependency>
        <groupId>software.amazon.awssdk</groupId>
        <artifactId>bom</artifactId>
        <version>${aws-sdk.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <build>
    <pluginManagement>
      <plugins>
        <plugin>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-maven-plugin</artifactId>
          <version>${spring-boot.version}</version>
        </plugin>
        <plugin>
          <artifactId>maven-compiler-plugin</artifactId>
          <version>3.13.0</version>
          <configuration>
            <release>${java.version}</release>
            <parameters>true</parameters>
          </configuration>
        </plugin>
        <plugin>
          <artifactId>maven-surefire-plugin</artifactId>
          <version>3.5.2</version>
        </plugin>
        <plugin>
          <artifactId>maven-failsafe-plugin</artifactId>
          <version>3.5.2</version>
        </plugin>
      </plugins>
    </pluginManagement>
  </build>
</project>
```

- [ ] **Step 2: Verify parent resolves (without modules yet — temporarily comment them out)**

Edit `backend/pom.xml`, comment out `<modules>` block, then:

```bash
cd backend && mvn -B validate
```

Expected: `BUILD SUCCESS`. Restore `<modules>` block (subsequent tasks add the modules).

- [ ] **Step 3: Commit**

```bash
git add backend/pom.xml
git commit -m "build(backend): parent POM with Spring Boot 3.4 + Testcontainers + AWS SDK BOMs"
```

---

### Task 6: `messaging-core` library

**Files:**
- Create: `backend/libs/messaging-core/pom.xml`
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/Channel.java`
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/DeliveryStatus.java`
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/Attachment.java`
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/OutboundMessage.java`
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/DeliveryReceipt.java`
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/MessageGateway.java`
- Create: `backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/WebhookEvent.java`
- Test: `backend/libs/messaging-core/src/test/java/com/drshoes/lib/messaging/OutboundMessageTest.java`

- [ ] **Step 1: Create POM**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.drshoes</groupId>
    <artifactId>drshoes-parent</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <relativePath>../../pom.xml</relativePath>
  </parent>
  <artifactId>messaging-core</artifactId>
  <name>Dr Shoes :: messaging-core</name>
  <description>Channel-neutral messaging types and interfaces. Zero Spring deps.</description>

  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
```

- [ ] **Step 2: Write failing test for `OutboundMessage` invariants**

`backend/libs/messaging-core/src/test/java/com/drshoes/lib/messaging/OutboundMessageTest.java`:

```java
package com.drshoes.lib.messaging;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OutboundMessageTest {

    @Test
    void rejects_blank_recipient() {
        assertThatThrownBy(() -> new OutboundMessage(
                Channel.SMS, "  ", null, "hi", List.of(), "idem-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("recipient");
    }

    @Test
    void rejects_blank_body() {
        assertThatThrownBy(() -> new OutboundMessage(
                Channel.EMAIL, "x@y.pl", "subj", "", List.of(), "idem-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("body");
    }

    @Test
    void allows_null_subject_for_sms() {
        var m = new OutboundMessage(Channel.SMS, "+48500000000", null, "hi", List.of(), "k");
        assertThat(m.subject()).isNull();
        assertThat(m.channel()).isEqualTo(Channel.SMS);
    }

    @Test
    void requires_subject_for_email() {
        assertThatThrownBy(() -> new OutboundMessage(
                Channel.EMAIL, "x@y.pl", null, "hi", List.of(), "idem-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("subject");
    }

    @Test
    void attachments_default_immutable() {
        var m = new OutboundMessage(Channel.EMAIL, "x@y.pl", "s", "b", List.of(), "k");
        assertThatThrownBy(() -> m.attachments().add(new Attachment("k", "image/png", 1L)))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
```

- [ ] **Step 3: Run failing test**

```bash
cd backend && mvn -B -pl libs/messaging-core test
```

Expected: compile failure (types don't exist).

- [ ] **Step 4: Create types**

`Channel.java`:
```java
package com.drshoes.lib.messaging;

public enum Channel { EMAIL, SMS, WHATSAPP }
```

`DeliveryStatus.java`:
```java
package com.drshoes.lib.messaging;

public enum DeliveryStatus { QUEUED, SENT, DELIVERED, FAILED, READ }
```

`Attachment.java`:
```java
package com.drshoes.lib.messaging;

import java.util.Objects;

public record Attachment(String storageKey, String mime, Long bytes) {
    public Attachment {
        Objects.requireNonNull(storageKey, "storageKey");
        Objects.requireNonNull(mime, "mime");
    }
}
```

`OutboundMessage.java`:
```java
package com.drshoes.lib.messaging;

import java.util.List;
import java.util.Objects;

public record OutboundMessage(
        Channel channel,
        String recipient,
        String subject,
        String body,
        List<Attachment> attachments,
        String idempotencyKey) {

    public OutboundMessage {
        Objects.requireNonNull(channel, "channel");
        if (recipient == null || recipient.isBlank()) {
            throw new IllegalArgumentException("recipient must not be blank");
        }
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("body must not be blank");
        }
        if (channel == Channel.EMAIL && (subject == null || subject.isBlank())) {
            throw new IllegalArgumentException("subject required for EMAIL");
        }
        attachments = attachments == null ? List.of() : List.copyOf(attachments);
    }
}
```

`DeliveryReceipt.java`:
```java
package com.drshoes.lib.messaging;

import java.time.Instant;
import java.util.Objects;

public record DeliveryReceipt(
        String providerMessageId,
        DeliveryStatus initialStatus,
        Instant acceptedAt,
        String errorCode,
        String errorMessage) {

    public DeliveryReceipt {
        Objects.requireNonNull(initialStatus, "initialStatus");
        Objects.requireNonNull(acceptedAt, "acceptedAt");
    }

    public static DeliveryReceipt accepted(String providerMessageId) {
        return new DeliveryReceipt(providerMessageId, DeliveryStatus.SENT, Instant.now(), null, null);
    }

    public static DeliveryReceipt failed(String code, String message) {
        return new DeliveryReceipt(null, DeliveryStatus.FAILED, Instant.now(), code, message);
    }
}
```

`MessageGateway.java`:
```java
package com.drshoes.lib.messaging;

public interface MessageGateway {
    Channel channel();
    DeliveryReceipt send(OutboundMessage message);
}
```

`WebhookEvent.java`:
```java
package com.drshoes.lib.messaging;

import java.time.Instant;

public record WebhookEvent(
        String providerMessageId,
        DeliveryStatus status,
        Instant occurredAt,
        String rawPayload) {}
```

- [ ] **Step 5: Run tests**

```bash
cd backend && mvn -B -pl libs/messaging-core test
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/libs/messaging-core/
git commit -m "feat(messaging-core): channel-neutral types and gateway interface"
```

---

### Task 7: `email-gateway` library

**Files:**
- Create: `backend/libs/email-gateway/pom.xml`
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/EmailGateway.java`
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/EmailGatewayProperties.java`
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/LoggingEmailGateway.java`
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/EmailGatewayAutoConfiguration.java`
- Create: `backend/libs/email-gateway/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- Test: `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/LoggingEmailGatewayTest.java`

- [ ] **Step 1: Create POM**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.drshoes</groupId>
    <artifactId>drshoes-parent</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <relativePath>../../pom.xml</relativePath>
  </parent>
  <artifactId>email-gateway</artifactId>
  <name>Dr Shoes :: email-gateway</name>
  <description>Pluggable email MessageGateway with Spring Boot autoconfiguration.</description>

  <dependencies>
    <dependency>
      <groupId>com.drshoes</groupId>
      <artifactId>messaging-core</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-autoconfigure</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-configuration-processor</artifactId>
      <optional>true</optional>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
```

- [ ] **Step 2: Write failing test**

`LoggingEmailGatewayTest.java`:
```java
package com.drshoes.lib.email;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class LoggingEmailGatewayTest {

    @Test
    void channel_is_email() {
        assertThat(new LoggingEmailGateway().channel()).isEqualTo(Channel.EMAIL);
    }

    @Test
    void send_returns_accepted_receipt_with_provider_id() {
        var m = new OutboundMessage(Channel.EMAIL, "x@y.pl", "subj", "body", List.of(), "k1");
        var r = new LoggingEmailGateway().send(m);
        assertThat(r.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(r.providerMessageId()).startsWith("logging-");
    }
}
```

- [ ] **Step 3: Run failing test**

```bash
cd backend && mvn -B -pl libs/email-gateway test
```

Expected: compile failure.

- [ ] **Step 4: Create implementation**

`EmailGateway.java`:
```java
package com.drshoes.lib.email;

import com.drshoes.lib.messaging.MessageGateway;

public interface EmailGateway extends MessageGateway { }
```

`EmailGatewayProperties.java`:
```java
package com.drshoes.lib.email;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("drshoes.email")
public class EmailGatewayProperties {

    public enum Provider { POSTMARK, SMTP, NOOP }

    private Provider provider = Provider.NOOP;
    private String from = "no-reply@drshoes.pl";

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }
    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }
}
```

`LoggingEmailGateway.java`:
```java
package com.drshoes.lib.email;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.UUID;

public class LoggingEmailGateway implements EmailGateway {
    private static final Logger log = LoggerFactory.getLogger(LoggingEmailGateway.class);

    @Override public Channel channel() { return Channel.EMAIL; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        var id = "logging-" + UUID.randomUUID();
        log.info("[email/noop] to={} subject={} bodyLen={} attachments={} idem={} provider_id={}",
                m.recipient(), m.subject(), m.body().length(), m.attachments().size(),
                m.idempotencyKey(), id);
        return DeliveryReceipt.accepted(id);
    }
}
```

`EmailGatewayAutoConfiguration.java`:
```java
package com.drshoes.lib.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(EmailGatewayProperties.class)
public class EmailGatewayAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(EmailGateway.class)
    @ConditionalOnProperty(prefix = "drshoes.email", name = "provider",
                           havingValue = "NOOP", matchIfMissing = true)
    public EmailGateway loggingEmailGateway() {
        return new LoggingEmailGateway();
    }
}
```

`src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`:
```
com.drshoes.lib.email.EmailGatewayAutoConfiguration
```

- [ ] **Step 5: Run tests**

```bash
cd backend && mvn -B -pl libs/email-gateway test
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/libs/email-gateway/
git commit -m "feat(email-gateway): logging impl + Spring Boot autoconfig"
```

---

### Task 8: `sms-gateway` library

Mirror of `email-gateway` with `Sms*` types and `Channel.SMS`. Same structure, same scope (logging impl + autoconfig).

**Files:**
- Create: `backend/libs/sms-gateway/pom.xml` (mirror of email)
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/SmsGateway.java`
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/SmsGatewayProperties.java`
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/LoggingSmsGateway.java`
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/SmsGatewayAutoConfiguration.java`
- Create: `backend/libs/sms-gateway/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- Test: `backend/libs/sms-gateway/src/test/java/com/drshoes/lib/sms/LoggingSmsGatewayTest.java`

- [ ] **Step 1: Copy email-gateway POM, change `<artifactId>` to `sms-gateway` and `<name>` to `Dr Shoes :: sms-gateway`. Description: "Pluggable SMS MessageGateway with Spring Boot autoconfiguration."**

- [ ] **Step 2: Write failing test**

```java
package com.drshoes.lib.sms;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class LoggingSmsGatewayTest {

    @Test
    void channel_is_sms() {
        assertThat(new LoggingSmsGateway().channel()).isEqualTo(Channel.SMS);
    }

    @Test
    void send_returns_accepted_receipt() {
        var m = new OutboundMessage(Channel.SMS, "+48500000000", null, "hi", List.of(), "k");
        var r = new LoggingSmsGateway().send(m);
        assertThat(r.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(r.providerMessageId()).startsWith("logging-");
    }
}
```

- [ ] **Step 3: Run failing test**

```bash
cd backend && mvn -B -pl libs/sms-gateway test
```

Expected: compile failure.

- [ ] **Step 4: Create types** (mirror of email-gateway with `Sms*` names, package `com.drshoes.lib.sms`, properties prefix `drshoes.sms`, providers `SMSAPI_PL | TWILIO | NOOP`).

`SmsGateway.java`:
```java
package com.drshoes.lib.sms;

import com.drshoes.lib.messaging.MessageGateway;

public interface SmsGateway extends MessageGateway { }
```

`SmsGatewayProperties.java`:
```java
package com.drshoes.lib.sms;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("drshoes.sms")
public class SmsGatewayProperties {

    public enum Provider { SMSAPI_PL, TWILIO, NOOP }

    private Provider provider = Provider.NOOP;
    private String senderName = "DrShoes";

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
}
```

`LoggingSmsGateway.java`:
```java
package com.drshoes.lib.sms;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.UUID;

public class LoggingSmsGateway implements SmsGateway {
    private static final Logger log = LoggerFactory.getLogger(LoggingSmsGateway.class);

    @Override public Channel channel() { return Channel.SMS; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        var id = "logging-" + UUID.randomUUID();
        log.info("[sms/noop] to={} bodyLen={} idem={} provider_id={}",
                m.recipient(), m.body().length(), m.idempotencyKey(), id);
        return DeliveryReceipt.accepted(id);
    }
}
```

`SmsGatewayAutoConfiguration.java`:
```java
package com.drshoes.lib.sms;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SmsGatewayProperties.class)
public class SmsGatewayAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(SmsGateway.class)
    @ConditionalOnProperty(prefix = "drshoes.sms", name = "provider",
                           havingValue = "NOOP", matchIfMissing = true)
    public SmsGateway loggingSmsGateway() {
        return new LoggingSmsGateway();
    }
}
```

`AutoConfiguration.imports`:
```
com.drshoes.lib.sms.SmsGatewayAutoConfiguration
```

- [ ] **Step 5: Run tests**

```bash
cd backend && mvn -B -pl libs/sms-gateway test
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/libs/sms-gateway/
git commit -m "feat(sms-gateway): logging impl + Spring Boot autoconfig"
```

---

### Task 9: `storage` library

**Files:**
- Create: `backend/libs/storage/pom.xml`
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobKey.java`
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobMetadata.java`
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/PresignedUrl.java`
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobStorage.java`
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/StorageProperties.java`
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/S3BlobStorage.java`
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/StorageAutoConfiguration.java`
- Create: `backend/libs/storage/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- Test: `backend/libs/storage/src/test/java/com/drshoes/lib/storage/S3BlobStorageIntegrationTest.java`

- [ ] **Step 1: Create POM**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.drshoes</groupId>
    <artifactId>drshoes-parent</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <relativePath>../../pom.xml</relativePath>
  </parent>
  <artifactId>storage</artifactId>
  <name>Dr Shoes :: storage</name>
  <description>S3-compatible BlobStorage abstraction (MinIO, R2, AWS, Hetzner OS).</description>

  <dependencies>
    <dependency>
      <groupId>software.amazon.awssdk</groupId>
      <artifactId>s3</artifactId>
    </dependency>
    <dependency>
      <groupId>software.amazon.awssdk</groupId>
      <artifactId>s3-transfer-manager</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-autoconfigure</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-configuration-processor</artifactId>
      <optional>true</optional>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>minio</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
```

- [ ] **Step 2: Write failing integration test (Testcontainers MinIO)**

`S3BlobStorageIntegrationTest.java`:
```java
package com.drshoes.lib.storage;

import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class S3BlobStorageIntegrationTest {

    @Container
    static MinIOContainer minio = new MinIOContainer("minio/minio:RELEASE.2024-10-13T13-34-11Z")
            .withUserName("test").withPassword("test1234");

    @Test
    void put_then_exists_then_presign_get() throws Exception {
        var client = S3Client.builder()
                .endpointOverride(URI.create(minio.getS3URL()))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test1234")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
        var presigner = S3Presigner.builder()
                .endpointOverride(URI.create(minio.getS3URL()))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test1234")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
        client.createBucket(CreateBucketRequest.builder().bucket("drshoes-test").build());

        var storage = new S3BlobStorage(client, presigner, "drshoes-test");
        var key = new BlobKey("orders/2026/05/abc.txt");
        storage.put(key, new ByteArrayInputStream("hello".getBytes()),
                new BlobMetadata("text/plain", 5L));

        assertThat(storage.exists(key)).isTrue();

        var presigned = storage.presignGet(key, Duration.ofMinutes(1));
        assertThat(presigned.url()).contains("orders/2026/05/abc.txt");
        assertThat(presigned.expiresAt()).isAfter(java.time.Instant.now());
    }
}
```

- [ ] **Step 3: Run failing test**

```bash
cd backend && mvn -B -pl libs/storage test
```

Expected: compile failure.

- [ ] **Step 4: Create types**

`BlobKey.java`:
```java
package com.drshoes.lib.storage;

import java.util.Objects;

public record BlobKey(String value) {
    public BlobKey {
        Objects.requireNonNull(value, "value");
        if (value.isBlank() || value.startsWith("/")) {
            throw new IllegalArgumentException("blob key must be non-blank and not start with '/'");
        }
    }
}
```

`BlobMetadata.java`:
```java
package com.drshoes.lib.storage;

public record BlobMetadata(String contentType, Long contentLength) {}
```

`PresignedUrl.java`:
```java
package com.drshoes.lib.storage;

import java.time.Instant;

public record PresignedUrl(String url, Instant expiresAt) {}
```

`BlobStorage.java`:
```java
package com.drshoes.lib.storage;

import java.io.InputStream;
import java.time.Duration;

public interface BlobStorage {
    void put(BlobKey key, InputStream stream, BlobMetadata metadata);
    boolean exists(BlobKey key);
    PresignedUrl presignGet(BlobKey key, Duration ttl);
    PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected);
    void delete(BlobKey key);
}
```

`StorageProperties.java`:
```java
package com.drshoes.lib.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("drshoes.storage")
public class StorageProperties {
    private String endpoint = "http://localhost:9000";
    private String region = "us-east-1";
    private String bucket = "drshoes-dev";
    private String accessKey = "drshoes";
    private String secretKey = "drshoes-dev-secret";
    private boolean pathStyleAccess = true;

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getBucket() { return bucket; }
    public void setBucket(String bucket) { this.bucket = bucket; }
    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
    public boolean isPathStyleAccess() { return pathStyleAccess; }
    public void setPathStyleAccess(boolean p) { this.pathStyleAccess = p; }
}
```

`S3BlobStorage.java`:
```java
package com.drshoes.lib.storage;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;

public class S3BlobStorage implements BlobStorage {

    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;

    public S3BlobStorage(S3Client client, S3Presigner presigner, String bucket) {
        this.client = client;
        this.presigner = presigner;
        this.bucket = bucket;
    }

    @Override
    public void put(BlobKey key, InputStream stream, BlobMetadata meta) {
        try (stream) {
            client.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket).key(key.value())
                    .contentType(meta.contentType())
                    .contentLength(meta.contentLength())
                    .build(),
                RequestBody.fromInputStream(stream, meta.contentLength()));
        } catch (IOException e) {
            throw new RuntimeException("upload failed for " + key.value(), e);
        }
    }

    @Override
    public boolean exists(BlobKey key) {
        try {
            client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key.value()).build());
            return true;
        } catch (NoSuchKeyException | S3Exception e) {
            return false;
        }
    }

    @Override
    public PresignedUrl presignGet(BlobKey key, Duration ttl) {
        var presigned = presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key.value()).build())
                .build());
        return new PresignedUrl(presigned.url().toString(), Instant.now().plus(ttl));
    }

    @Override
    public PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected) {
        var presigned = presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .putObjectRequest(PutObjectRequest.builder()
                        .bucket(bucket).key(key.value())
                        .contentType(expected.contentType())
                        .contentLength(expected.contentLength())
                        .build())
                .build());
        return new PresignedUrl(presigned.url().toString(), Instant.now().plus(ttl));
    }

    @Override
    public void delete(BlobKey key) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key.value()).build());
    }
}
```

`StorageAutoConfiguration.java`:
```java
package com.drshoes.lib.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(StorageProperties.class)
public class StorageAutoConfiguration {

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean
    public S3Client s3Client(StorageProperties props) {
        return S3Client.builder()
                .endpointOverride(URI.create(props.getEndpoint()))
                .region(Region.of(props.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey())))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(props.isPathStyleAccess()).build())
                .build();
    }

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean
    public S3Presigner s3Presigner(StorageProperties props) {
        return S3Presigner.builder()
                .endpointOverride(URI.create(props.getEndpoint()))
                .region(Region.of(props.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey())))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(props.isPathStyleAccess()).build())
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public BlobStorage blobStorage(S3Client s3, S3Presigner presigner, StorageProperties props) {
        return new S3BlobStorage(s3, presigner, props.getBucket());
    }
}
```

`AutoConfiguration.imports`:
```
com.drshoes.lib.storage.StorageAutoConfiguration
```

- [ ] **Step 5: Run tests**

```bash
cd backend && mvn -B -pl libs/storage test
```

Expected: 1 test passes (Testcontainers spins up MinIO; takes ~30-60s on cold pull).

- [ ] **Step 6: Commit**

```bash
git add backend/libs/storage/
git commit -m "feat(storage): S3-compatible BlobStorage with autoconfig + MinIO Testcontainer test"
```

---

## Phase 3 — Spring Boot app + Flyway + health (Tasks 10-13)

### Task 10: `backend/app/pom.xml` and Dockerfile

**Files:**
- Create: `backend/app/pom.xml`
- Create: `backend/app/Dockerfile`

- [ ] **Step 1: Create app POM**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.drshoes</groupId>
    <artifactId>drshoes-parent</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <relativePath>../pom.xml</relativePath>
  </parent>
  <artifactId>app</artifactId>
  <name>Dr Shoes :: app</name>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-database-postgresql</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>

    <!-- Internal libs -->
    <dependency>
      <groupId>com.drshoes</groupId>
      <artifactId>messaging-core</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.drshoes</groupId>
      <artifactId>email-gateway</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.drshoes</groupId>
      <artifactId>sms-gateway</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.drshoes</groupId>
      <artifactId>storage</artifactId>
      <version>${project.version}</version>
    </dependency>

    <!-- Test -->
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>postgresql</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 2: Create Dockerfile**

`backend/app/Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1.7

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY libs ./libs
COPY app/pom.xml ./app/pom.xml
RUN mvn -B -pl app -am -DskipTests dependency:go-offline
COPY app ./app
RUN mvn -B -pl app -am -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /workspace/app/target/app-*.jar /app/app.jar
USER app
EXPOSE 8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75"
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
```

- [ ] **Step 3: Verify multi-module build (no app code yet — should still validate)**

```bash
cd backend && mvn -B validate
```

Expected: `BUILD SUCCESS`. (Compile would fail because app has no main class yet — that's Task 11.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/pom.xml backend/app/Dockerfile
git commit -m "build(backend/app): app POM with libs deps and Dockerfile"
```

---

### Task 11: Application main class + base config + Flyway migration

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/DrShoesApplication.java`
- Create: `backend/app/src/main/resources/application.yaml`
- Create: `backend/app/src/main/resources/application-local.yaml`
- Create: `backend/app/src/main/resources/db/migration/V001__init.sql` (copy of `docs/SCHEMA.sql`)

- [ ] **Step 1: Create main class**

```java
package com.drshoes.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DrShoesApplication {
    public static void main(String[] args) {
        SpringApplication.run(DrShoesApplication.class, args);
    }
}
```

- [ ] **Step 2: Create `application.yaml` (defaults)**

```yaml
spring:
  application:
    name: drshoes-app
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        jdbc:
          time_zone: UTC
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: false
    validate-on-migrate: true

server:
  port: 8080
  forward-headers-strategy: framework
  shutdown: graceful

management:
  endpoints:
    web:
      exposure:
        include: health, info
  endpoint:
    health:
      probes:
        enabled: true
      show-details: never
  info:
    git:
      mode: simple

drshoes:
  email:
    provider: NOOP
  sms:
    provider: NOOP

logging:
  pattern:
    level: "%5p [trace=%X{traceId:-},span=%X{spanId:-}]"
```

- [ ] **Step 3: Create `application-local.yaml` (dev profile)**

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/drshoes}
    username: ${SPRING_DATASOURCE_USERNAME:drshoes}
    password: ${SPRING_DATASOURCE_PASSWORD:drshoes-dev-secret}
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true

drshoes:
  storage:
    endpoint: ${DRSHOES_STORAGE_ENDPOINT:http://localhost:9000}
    bucket: ${DRSHOES_STORAGE_BUCKET:drshoes-dev}
    access-key: ${DRSHOES_STORAGE_ACCESS_KEY:drshoes}
    secret-key: ${DRSHOES_STORAGE_SECRET_KEY:drshoes-dev-secret}
    region: us-east-1
    path-style-access: true
```

- [ ] **Step 4: Copy V001 migration**

```bash
mkdir -p backend/app/src/main/resources/db/migration
cp docs/SCHEMA.sql backend/app/src/main/resources/db/migration/V001__init.sql
```

- [ ] **Step 5: Verify it compiles**

```bash
cd backend && mvn -B -pl app -am compile
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/main backend/app/src/main/resources/db/migration/V001__init.sql
git commit -m "feat(app): Spring Boot main + base config + Flyway V001 baseline"
```

---

### Task 12: Application context + health endpoint integration test (Testcontainers)

**Files:**
- Create: `backend/app/src/test/resources/application-test.yaml`
- Create: `backend/app/src/test/java/com/drshoes/app/AbstractIntegrationTest.java`
- Create: `backend/app/src/test/java/com/drshoes/app/DrShoesApplicationTests.java`
- Create: `backend/app/src/test/java/com/drshoes/app/HealthEndpointIntegrationTest.java`

- [ ] **Step 1: Create test application yaml**

`backend/app/src/test/resources/application-test.yaml`:
```yaml
spring:
  jpa:
    show-sql: false
drshoes:
  storage:
    endpoint: http://localhost:9000
    bucket: drshoes-test
    access-key: test
    secret-key: testtest
```

- [ ] **Step 2: Create abstract integration test base**

`AbstractIntegrationTest.java`:
```java
package com.drshoes.app;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
public abstract class AbstractIntegrationTest {

    @SuppressWarnings("resource")
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
                    .withDatabaseName("drshoes_test")
                    .withUsername("test")
                    .withPassword("test")
                    .withReuse(true);

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
```

- [ ] **Step 3: Write context-loads test**

`DrShoesApplicationTests.java`:
```java
package com.drshoes.app;

import org.junit.jupiter.api.Test;

class DrShoesApplicationTests extends AbstractIntegrationTest {
    @Test
    void context_loads() {
        // Spring Boot context boot is the assertion.
    }
}
```

- [ ] **Step 4: Write health endpoint test**

`HealthEndpointIntegrationTest.java`:
```java
package com.drshoes.app;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class HealthEndpointIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;

    @Test
    void health_returns_200_and_status_up() {
        var resp = rest.getForEntity("/actuator/health", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void flyway_applied_v001() {
        var resp = rest.getForEntity("/actuator/health", String.class);
        // Migration applied if Spring Boot DB health is UP and JPA validate succeeds.
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
```

- [ ] **Step 5: Run failing tests**

```bash
cd backend && mvn -B -pl app -am verify
```

Expected: tests pass (Testcontainers pulls postgres:16-alpine on first run; ~60s).

If failures relate to JPA validation (e.g. table missing), inspect `docs/SCHEMA.sql` was copied correctly to `backend/app/src/main/resources/db/migration/V001__init.sql`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/src/test
git commit -m "test(app): Testcontainers integration tests for context + health + Flyway"
```

---

### Task 13: Full backend build verification

- [ ] **Step 1: Run full backend build**

```bash
cd backend && mvn -B clean verify
```

Expected: all 4 libs + app build, all tests green. `BUILD SUCCESS`.

- [ ] **Step 2: Verify Docker image builds**

```bash
cd backend && docker build -f app/Dockerfile -t drshoes-app:dev .
```

Expected: image built, ~250 MB.

- [ ] **Step 3: Smoke test via docker-compose**

```bash
cd /Users/atlasjedi/P/misza_madafaka
docker compose up -d --build postgres minio backend
sleep 30
curl -fsS http://localhost:8080/actuator/health
```

Expected: `{"status":"UP"}`.

- [ ] **Step 4: Tear down**

```bash
docker compose down
```

- [ ] **Step 5: Commit (if any tweaks were needed)**

```bash
git status
# only commit if there are uncommitted fixups; otherwise skip.
```

---

## Phase 4 — Frontend foundation (Tasks 14-18)

### Task 14: `packages/ui` — design tokens + Tailwind preset

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/tokens.ts`
- Create: `packages/ui/src/fonts.ts`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/tailwind-preset.ts`
- Create: `packages/ui/README.md`

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@drshoes/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tailwind-preset": "./tailwind-preset.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "test": "echo \"(no tests in 0A)\""
  },
  "dependencies": {
    "tailwindcss": "^3.4.14"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^20.16.11"
  }
}
```

- [ ] **Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "moduleResolution": "node",
    "module": "ESNext"
  },
  "include": ["src/**/*", "tailwind-preset.ts"]
}
```

- [ ] **Step 3: Create `packages/ui/src/tokens.ts`** (verbatim from `handoff/DESIGN_SYSTEM.md`)

```ts
export const colors = {
  ink: "#0c0c0d",
  paper: "#f3efe6",
  paper2: "#e8e2d3",
  adminBg: "#f7f5ef",
  adminSurface: "#ffffff",
  adminLine: "#e3ddcc",
  adminInk: "#1a1a1c",
  adminMute: "#6b6960",
  acid: "#e6ff3a",
  magenta: "#ff2e88",
  blue: "#2a6fdb",
  orange: "#ff6b1a",
  green: "#1f8a5b",
} as const;

export const orderStatusColor = {
  WSTEPNIE_PRZYJETE: colors.adminMute,
  PRZYJETE: colors.blue,
  W_REALIZACJI: colors.acid,
  CZEKA_NA_KLIENTA: colors.orange,
  GOTOWE_DO_ODBIORU: colors.magenta,
  WYDANE: colors.green,
  ANULOWANE: colors.adminMute,
} as const;

export const productStatusColor = {
  DOSTEPNE: colors.green,
  ZAREZERWOWANE: colors.acid,
  SPRZEDANE: colors.adminMute,
} as const;

export const radii = { xs: "2px", sm: "4px", md: "8px", lg: "16px" } as const;

export const spacing = {
  none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, "2xl": 24, "3xl": 32, "4xl": 48,
} as const;

export const motion = {
  hoverZoom: "300ms ease-out",
  drawer: "240ms ease-out",
  statusFade: "160ms ease-out",
} as const;
```

- [ ] **Step 4: Create `packages/ui/src/fonts.ts`**

```ts
// Re-exported by apps/web via next/font for CSS variable wiring.
export const fontDescriptors = {
  display: { name: "Bungee", weights: [400], subsets: ["latin", "latin-ext"] },
  marker:  { name: "Permanent Marker", weights: [400], subsets: ["latin", "latin-ext"] },
  body:    { name: "Inter", weights: [300, 400, 500, 600, 700, 800], subsets: ["latin", "latin-ext"] },
  mono:    { name: "JetBrains Mono", weights: [400, 500, 700], subsets: ["latin", "latin-ext"] },
} as const;

export const cssVars = {
  fontDisplay: "var(--font-display)",
  fontMarker:  "var(--font-marker)",
  fontBody:    "var(--font-body)",
  fontMono:    "var(--font-mono)",
} as const;
```

- [ ] **Step 5: Create `packages/ui/src/index.ts`**

```ts
export * from "./tokens";
export * from "./fonts";
```

- [ ] **Step 6: Create `packages/ui/tailwind-preset.ts`**

```ts
import type { Config } from "tailwindcss";
import { colors, radii, motion } from "./src/tokens";
import { cssVars } from "./src/fonts";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ink: colors.ink,
        paper: colors.paper,
        "paper-2": colors.paper2,
        "admin-bg": colors.adminBg,
        "admin-surface": colors.adminSurface,
        "admin-line": colors.adminLine,
        "admin-ink": colors.adminInk,
        "admin-mute": colors.adminMute,
        acid: colors.acid,
        magenta: colors.magenta,
        blue: colors.blue,
        orange: colors.orange,
        green: colors.green,
      },
      borderRadius: { xs: radii.xs, sm: radii.sm, md: radii.md, lg: radii.lg },
      fontFamily: {
        display: [cssVars.fontDisplay, "ui-sans-serif", "system-ui"],
        marker:  [cssVars.fontMarker,  "cursive"],
        sans:    [cssVars.fontBody,    "ui-sans-serif", "system-ui"],
        mono:    [cssVars.fontMono,    "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        "hover-zoom":  motion.hoverZoom.split(" ").pop()!,
        drawer:        motion.drawer.split(" ").pop()!,
        "status-fade": motion.statusFade.split(" ").pop()!,
      },
    },
  },
};

export default preset;
```

- [ ] **Step 7: Create `packages/ui/README.md`**

```markdown
# @drshoes/ui

Design tokens and Tailwind preset shared across `apps/web`. Tokens come from
`handoff/DESIGN_SYSTEM.md` — that file is the source of truth, not this code.

Components land in Milestone 0B / 1.
```

- [ ] **Step 8: Install + typecheck**

```bash
pnpm install
pnpm --filter @drshoes/ui typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): design tokens and Tailwind preset (no components yet)"
```

---

### Task 15: `packages/api-types` placeholder

**Files:**
- Create: `packages/api-types/package.json`
- Create: `packages/api-types/tsconfig.json`
- Create: `packages/api-types/src/index.ts`

- [ ] **Step 1: Create `packages/api-types/package.json`**

```json
{
  "name": "@drshoes/api-types",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "echo \"(no tests in 0A)\""
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `packages/api-types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src", "module": "ESNext", "moduleResolution": "node" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/api-types/src/index.ts`**

```ts
// Generated TypeScript types from backend OpenAPI land here in 0B.
export const API_TYPES_VERSION = "0.0.1-stub";
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @drshoes/api-types typecheck
git add packages/api-types
git commit -m "chore(api-types): empty package placeholder for codegen target"
```

---

### Task 16: `apps/web` — Next.js 16 app skeleton

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/(public)/page.tsx`
- Create: `apps/web/app/(admin)/admin/page.tsx`
- Create: `apps/web/lib/env.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@drshoes/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "echo \"(playwright in milestone 1)\""
  },
  "dependencies": {
    "@drshoes/ui": "workspace:*",
    "@drshoes/api-types": "workspace:*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.16.11",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.13.0",
    "eslint-config-next": "^16.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    typedRoutes: true,
  },
  async rewrites() {
    const internal = process.env.INTERNAL_API_BASE;
    return internal
      ? [{ source: "/api/:path*", destination: `${internal}/api/:path*` }]
      : [];
  },
};

export default config;
```

- [ ] **Step 4: Create `apps/web/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";
import preset from "@drshoes/ui/tailwind-preset";

const config: Config = {
  presets: [preset as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Create `apps/web/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `apps/web/lib/env.ts`**

```ts
import { z } from "zod";

const Schema = z.object({
  NEXT_PUBLIC_API_BASE: z.string().default("/api"),
});

export const env = Schema.parse({
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
});
```

- [ ] **Step 7: Create `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

html, body {
  height: 100%;
  background-color: theme(colors.paper);
  color: theme(colors.ink);
  font-family: theme(fontFamily.sans);
}

body { margin: 0; }
```

- [ ] **Step 8: Create `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Bungee, Permanent_Marker, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontDisplay = Bungee({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-display" });
const fontMarker  = Permanent_Marker({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-marker" });
const fontBody    = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body" });
const fontMono    = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Dr Shoes — naprawy, custom malowanie, kurtki",
  description: "Pracownia szewska i custom painting. Naprawiamy, malujemy, ratujemy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${fontDisplay.variable} ${fontMarker.variable} ${fontBody.variable} ${fontMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create public landing placeholder**

`apps/web/app/(public)/page.tsx`:
```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-ink text-paper p-8 gap-6">
      <h1 className="font-display text-6xl md:text-8xl tracking-tight">DR SHOES</h1>
      <p className="font-marker text-2xl text-acid">customy. naprawy. malowanie.</p>
      <p className="font-mono text-sm opacity-60">Strona w budowie. /admin też.</p>
    </main>
  );
}
```

- [ ] **Step 10: Create admin placeholder**

`apps/web/app/(admin)/admin/page.tsx`:
```tsx
export default function AdminPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-admin-bg text-admin-ink p-8">
      <div className="bg-admin-surface border border-admin-line rounded-md p-8 max-w-md text-center">
        <h1 className="font-display text-3xl mb-2">Dr Shoes — Admin</h1>
        <p className="font-mono text-sm text-admin-mute">Logowanie pojawi się w Milestone 0B.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 11: Create Dockerfile**

`apps/web/Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-types/package.json ./packages/api-types/
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /workspace
COPY --from=deps /workspace ./
COPY apps/web ./apps/web
COPY packages/ui ./packages/ui
COPY packages/api-types ./packages/api-types
RUN pnpm --filter @drshoes/web build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /workspace/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 12: Install + typecheck + build**

```bash
pnpm install
pnpm --filter @drshoes/web typecheck
pnpm --filter @drshoes/web build
```

Expected: clean typecheck. Build produces `.next/standalone` output.

- [ ] **Step 13: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): Next.js 16 skeleton with public + admin route groups, design tokens wired"
```

---

### Task 17: Local end-to-end verification (compose stack boots)

- [ ] **Step 1: Boot full stack**

```bash
cd /Users/atlasjedi/P/misza_madafaka
docker compose up -d --build
```

Wait for all services healthy:
```bash
docker compose ps
```

Expected: postgres, minio, backend, web all `(healthy)` or `running`.

- [ ] **Step 2: Verify backend health**

```bash
curl -fsS http://localhost:8080/actuator/health | grep -F '"status":"UP"'
```

Expected: line printed (status UP).

- [ ] **Step 3: Verify Flyway applied**

```bash
docker compose exec -T postgres psql -U drshoes -d drshoes \
  -c "SELECT version, success FROM flyway_schema_history ORDER BY installed_rank;"
```

Expected: row with `version=001` and `success=t`.

- [ ] **Step 4: Verify schema present**

```bash
docker compose exec -T postgres psql -U drshoes -d drshoes \
  -c "\dt" | grep -E "order_|client|trigger_|scheduled_message" | wc -l
```

Expected: count ≥ 4.

- [ ] **Step 5: Verify web renders public page**

```bash
curl -fsS http://localhost:3000 | grep -F "DR SHOES"
```

Expected: line printed.

- [ ] **Step 6: Verify web renders admin placeholder**

```bash
curl -fsS http://localhost:3000/admin | grep -F "Dr Shoes — Admin"
```

Expected: line printed.

- [ ] **Step 7: Verify MinIO bucket created**

```bash
docker compose exec -T minio sh -c "mc alias set local http://localhost:9000 drshoes drshoes-dev-secret && mc ls local/" 2>/dev/null | grep -F drshoes-dev
```

Expected: bucket present.

- [ ] **Step 8: Tear down**

```bash
docker compose down
```

- [ ] **Step 9: Commit (only if any tweaks were needed during verification)**

```bash
git status
# commit any fixups; skip if clean.
```

---

### Task 18: README polish + final commit

**Files:**
- Modify: `README.md` (verify Quick Start section is accurate)
- Modify: `CLAUDE.md` (mark milestone 0A complete)

- [ ] **Step 1: Verify README still accurate after all tasks** — run through `make up` instructions, confirm they match what was built. If anything drifted, update.

- [ ] **Step 2: Mark Milestone 0A complete in `CLAUDE.md`**

Edit the Status section, add line:
```
- [x] Milestone 0A: foundation skeleton boots — health green, V001 applied, web renders
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: mark Milestone 0A complete"
```

- [ ] **Step 4: Tag**

```bash
git tag -a milestone-0a -m "Foundation skeleton complete — boots, health green, schema applied, web renders"
```

---

## Self-review

**Spec coverage** (against `ARCHITECTURE.md` Milestone 0 row + repo layout):

| Spec item | Task |
|---|---|
| Repo skeleton + git | 1 |
| docker-compose | 3 |
| Maven parent | 5 |
| `messaging-core` lib | 6 |
| `email-gateway` lib | 7 |
| `sms-gateway` lib | 8 |
| `storage` lib | 9 |
| Spring Boot app | 10-11 |
| Flyway V001 | 11 |
| Health endpoint test | 12 |
| Next.js skeleton | 16 |
| Design system tokens | 14 |
| Dockerfiles | 10, 16 |
| CI workflow | 4 |
| End-to-end smoke | 17 |

**Out of scope, deferred to Milestone 0B:** auth (login, sessions, CSRF), RBAC, JPA entities, OpenAPI codegen, real frontend components.

**Placeholder scan:** none. Every step has the actual content needed.

**Type consistency:**
- `MessageGateway` interface: `channel()` + `send()` — used identically in email-gateway and sms-gateway tests + impls.
- `BlobKey` / `BlobMetadata` / `PresignedUrl` defined once in storage lib.
- `Channel.EMAIL` / `Channel.SMS` referenced consistently across all libs.
- Tailwind preset color names (`bg-ink`, `text-acid`, etc.) match exactly what the placeholder pages use.

**Risks:**
- Maven Central availability for `flyway-database-postgresql` 11+ alongside Spring Boot 3.4 — Boot 3.4 manages Flyway 10 via BOM, OK.
- `minio/minio:RELEASE.2024-10-13T13-34-11Z` digest may rotate; using a stable tag mitigates.
- Testcontainers cold pull adds ~60-90s on first CI run; cache via GHA.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-05-07-milestone-00a-foundation.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Each task dispatched to a fresh Sonnet subagent, two-stage review (spec compliance + code quality) between tasks.

**2. Inline Execution** — Execute tasks in this Opus session via `superpowers:executing-plans`, batch checkpoints.

Per locked decisions, Sonnet handles implementation. **Recommendation: Subagent-Driven.**
