# Order list scale to 1k — dispatch log
**UTC:** 20260520T130941Z
**Plan:** docs/superpowers/plans/2026-05-20-order-list-scale-1k.md
**Spec:** docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md
**Branch:** client-adjustments-2026-05-19
**Stage:** combined single-stage (mechanical TDD)

## Files touched
- CREATE `backend/app/src/main/java/com/drshoes/app/order/OrderListPolicy.java` — new policy class: normalizes raw statuses into EffectiveFilter (statuses + nullable wydaneCutoff), ANULOWANE throws IAE
- CREATE `backend/app/src/test/java/com/drshoes/app/order/OrderListPolicyTest.java` — 7 pure-unit tests covering all 6 policy resolution cases
- MODIFY `backend/app/src/main/java/com/drshoes/app/order/OrderSpecifications.java` — forList gains nullable `wydaneCutoff` param; status predicate becomes OR-branch when cutoff is non-null
- MODIFY `backend/app/src/main/java/com/drshoes/app/order/OrderService.java` — list() calls OrderListPolicy.resolve() first, threads EffectiveFilter into forList
- MODIFY `backend/app/src/main/java/com/drshoes/app/order/api/OrderController.java` — return type changed to ResponseEntity<?>; ANULOWANE guard returns 400; log gets rawStatus + count fields
- MODIFY `backend/app/src/test/java/com/drshoes/app/order/OrderControllerIntegrationTest.java` — +4 IT cases: default hides ANULOWANE, default caps WYDANE @ 30d, ?status=ANULOWANE returns 400, explicit ?status=WYDANE escape hatch
- CREATE `backend/app/src/test/java/com/drshoes/app/order/OrderRepositoryListIntegrationTest.java` — 3 Testcontainers Postgres ITs guarding Specification → SQL translation
- CREATE `backend/app/src/main/resources/db/migration/V034__order_list_perf_indexes.sql` — 3 partial B-tree indexes: order_active_created_at_idx, order_status_received_at_idx, order_wydane_picked_up_at_idx

## Commands run
- `mvn -pl app -Dtest=OrderListPolicyTest test` — RED (compile failure), then GREEN (7/7)
- `mvn -pl app -Dtest=OrderControllerIntegrationTest test` — 25/25 GREEN after Task 2 (no regression)
- `mvn -pl app -am -DskipTests=false test` — 526 GREEN after Task 2, 530 GREEN after Task 3
- `mvn -pl app -Dtest=OrderControllerIntegrationTest#listDefaultHidesAnulowaneEntirely+...` — 3/4 pass, 1 fail (listExplicitAnulowaneReturns400) — RED confirmed
- `mvn -pl app -Dtest=OrderControllerIntegrationTest test` — 29/29 GREEN after Task 3
- `mvn -pl app -Dtest=OrderRepositoryListIntegrationTest test` — 3/3 GREEN (Tasks 4 + 5 with V034)
- `mvn -pl app -am -DskipTests clean package` — jar rebuilt before docker compose build
- `docker compose build backend && docker compose up -d backend` — container rebuilt with new jar
- `docker compose exec -T postgres psql -U drshoes -d drshoes -c "\d order_"` — confirmed all 3 new indexes present
- `curl http://localhost:8081/actuator/health` — status: UP
- `curl http://localhost:8081/api/admin/orders?size=100` — default list: no ANULOWANE, 4 WYDANE rows
- `curl http://localhost:8081/api/admin/orders?status=ANULOWANE` — 400 + {"error":"status.anulowane.disallowed"}
- `curl http://localhost:8081/api/admin/orders?status=WYDANE&size=100` — 4 WYDANE regardless of age
- `curl http://localhost:8081/api/admin/orders/kanban` — 5 columns, no errors
- `curl http://localhost:8081/api/admin/orders/calendar?from=...&to=...` — calendar keys present

## Test summary
- Baseline backend suite: ~519 tests (all submodules), all green
- After Task 1: +7 unit tests (OrderListPolicyTest), total 526 green
- After Task 2: no new tests; existing 526 still green
- After Task 3: +4 controller IT, total 530 green
- After Task 4: +3 repo IT, total 533 green
- After Task 5: V034 applied via Testcontainers (34 migrations to v034), suite re-run 533 green

## Commits (newest first)
- ef6f311: feat(db): V034 partial indexes for order list + kanban [milestone:client-adj][task:5]
- 2d0e7d6: test(orders): repo-level IT for default list policy [milestone:client-adj][task:4]
- 927e92f: feat(orders): reject explicit status=ANULOWANE on list [milestone:client-adj][task:3]
- 2eff3c7: refactor(orders): thread EffectiveFilter through list path [milestone:client-adj][task:2]
- 6b29fd1: feat(orders): add OrderListPolicy for default status filter [milestone:client-adj][task:1]

## Decisions / deviations from plan
- Login endpoint is `/api/admin/auth/login` on port 8081 (not `/api/auth/login` on port 3000 as in plan's Task 6 smoke step). The curl smokes were run against backend directly at port 8081. All verifications passed.
- JAVA_HOME required explicit override to `/opt/homebrew/Cellar/openjdk@21/21.0.11/libexec/openjdk.jdk/Contents/Home` since the shell default pointed to OpenJDK 26. Maven resolved correctly with the explicit path.
- All other steps executed literally as written in the plan.

## Smoke (Task 6) — backend curl verified; Playwright deferred to main session
- `GET /api/admin/orders?size=100` — default list: statuses = {PRZYJETE:5, WSTEPNIE_PRZYJETE:1, W_REALIZACJI:4, CZEKA_NA_KLIENTA:1, GOTOWE_DO_ODBIORU:2, WYDANE:4}, zero ANULOWANE ✓
- `GET /api/admin/orders?status=ANULOWANE` — 400 + `{"error":"status.anulowane.disallowed"}` ✓
- `GET /api/admin/orders?status=WYDANE&size=100` — count=4, statuses={WYDANE} ✓
- `GET /api/admin/orders/kanban` — 5 columns, no errors ✓
- `GET /api/admin/orders/calendar?from=...&to=...` — keys=['scheduled','unscheduled'], no errors ✓
- Backend logs: `op=listOrders actor=misza@drshoes.pl rawStatus=null count=17 outcome=ok` (default); `outcome=blocked reason=status.anulowane.disallowed` (ANULOWANE guard); `rawStatus=[WYDANE] count=4 outcome=ok` (escape hatch) ✓
- Playwright smoke (Task 6 Step 6.5) is deferred to main session using `mcp__playwright__*` tools.

## Open follow-ups
- None. All tasks executed cleanly. Playwright UI smoke is the only remaining step (Task 8 in main session task list).
