# MODULE_MAP — Dr Shoes Admin

Quick lookup table: given a bug report's `url` field (or any feature keyword),
find the 2–5 most relevant files to open in the editor. Used by `tools/where-is`
and pasted directly into Claude when filing a bug with a trace-id.

**How to read:** Feature column is the search key. Frontend paths are relative to
`apps/web/`. Backend paths are relative to `backend/app/src/main/java/com/drshoes/app/`.
Test paths are relative to their respective source roots.

| Feature | URL pattern | Frontend files | Backend files | Primary tests |
|---|---|---|---|---|
| Dashboard | `/admin` | `app/(admin)/admin/page.tsx`, `app/(admin)/admin/_components/KpiTilesRow.tsx`, `app/(admin)/admin/_components/OrdersWeekChart.tsx`, `app/(admin)/admin/_components/MixDonut.tsx` | `dashboard/api/DashboardController.java`, `dashboard/api/DashboardChartsController.java` | `dashboard/api/DashboardKpiControllerIntegrationTest.java`, `app/(admin)/admin/_components/__tests__/KpiTilesRow.test.tsx` |
| Orders list | `/admin/orders` | `app/(admin)/admin/orders/page.tsx`, `app/(admin)/admin/orders/_components/OrdersTable.tsx`, `app/(admin)/admin/orders/_components/OrdersFilters.tsx`, `app/(admin)/admin/orders/_components/OrdersPageClient.tsx` | `order/api/OrderController.java`, `order/OrderService.java`, `order/domain/OrderRepository.java` | `order/OrderControllerIntegrationTest.java`, `order/api/OrderListExtendedIntegrationTest.java` |
| Order drawer | `/admin/orders?orderId=:id` | `app/(admin)/admin/orders/_components/OrderDrawer.tsx`, `app/(admin)/admin/orders/_components/OrderDrawerCoreFields.tsx`, `app/(admin)/admin/orders/_components/OrderDrawerStatusChanger.tsx`, `app/(admin)/admin/orders/_components/OrderDrawerTimeline.tsx`, `app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx` | `order/api/OrderController.java`, `order/OrderService.java`, `audit/api/AuditTimelineController.java` | `order/OrderControllerIntegrationTest.java`, `audit/AuditLogAspectIntegrationTest.java` |
| Order create | `/admin/orders/new` | `app/(admin)/admin/orders/new/page.tsx`, `app/(admin)/admin/orders/new/_components/NewOrderForm.tsx`, `app/(admin)/admin/orders/new/_components/NewOrderItemRow.tsx`, `components/clients/ClientPicker.tsx` | `order/api/OrderController.java`, `order/OrderService.java` | `order/OrderControllerIntegrationTest.java` |
| Order status change + triggers | `/admin/orders?orderId=:id` (drawer) | `app/(admin)/admin/orders/_components/OrderDrawerStatusChanger.tsx`, `app/(admin)/admin/orders/_components/StatusChangeTriggerDialog.tsx`, `lib/orders/triggerPreview.ts`, `lib/orders/api.ts` | `order/api/OrderController.java`, `messaging/service/MessageGatewayDispatcher.java`, `messaging/service/TriggerEngine.java` | `order/OrderControllerIntegrationTest.java`, `app/(admin)/admin/orders/_components/__tests__/StatusChangeTriggerDialog.test.tsx` |
| Clients list | `/admin/clients` | `app/(admin)/admin/clients/page.tsx`, `app/(admin)/admin/clients/_components/ClientListTable.tsx`, `app/(admin)/admin/clients/_components/ClientListSearchBox.tsx` | `client/api/ClientController.java`, `client/ClientService.java`, `client/domain/ClientRepository.java` | `client/ClientControllerIntegrationTest.java`, `app/(admin)/admin/clients/_components/__tests__/ClientListTable.test.tsx` |
| Client detail | `/admin/clients/:id` | `app/(admin)/admin/clients/[id]/page.tsx`, `app/(admin)/admin/clients/[id]/_components/ClientHeader.tsx`, `app/(admin)/admin/clients/[id]/_components/ClientSummaryTiles.tsx`, `app/(admin)/admin/clients/[id]/_components/ClientTabNav.tsx` | `client/api/ClientController.java`, `client/api/ClientSummaryController.java`, `client/ClientSummaryService.java` | `client/ClientControllerIntegrationTest.java`, `client/ClientSummaryControllerIntegrationTest.java` |
| Client edit | `/admin/clients/:id` (modal) | `app/(admin)/admin/clients/_components/EditClientModal.tsx`, `app/(admin)/admin/clients/_components/useEditClientModalForm.ts`, `app/(admin)/admin/clients/[id]/_components/EditClientIsland.tsx` | `client/api/ClientController.java`, `client/ClientService.java` | `client/ClientControllerIntegrationTest.java`, `app/(admin)/admin/clients/_components/__tests__/EditClientModal.test.tsx` |
| Messages inbox | `/admin/messages` | `app/(admin)/admin/messages/page.tsx`, `app/(admin)/admin/messages/_components/MessagesShell.tsx`, `app/(admin)/admin/messages/_components/ThreadList.tsx`, `app/(admin)/admin/messages/_components/ThreadListRow.tsx` | `messaging/api/ThreadController.java`, `messaging/service/MessageThreadService.java` | `messaging/api/MessagesControllerIntegrationTest.java` |
| Messages thread | `/admin/messages?threadId=:id` | `app/(admin)/admin/messages/_components/SelectedThread.tsx`, `app/(admin)/admin/messages/_components/MessageBubble.tsx`, `app/(admin)/admin/messages/_components/ReplyComposer.tsx`, `app/(admin)/admin/messages/_components/useThreadPoller.ts` | `messaging/api/MessagesController.java`, `messaging/api/ThreadReplyController.java`, `messaging/api/ThreadMutationController.java` | `messaging/api/MessagesControllerIntegrationTest.java`, `messaging/api/ClientMessageControllerIntegrationTest.java` |
| Photos upload | `/admin/orders?orderId=:id` (drawer photos tab) | `app/(admin)/admin/orders/_components/OrderDrawerPhotos.tsx`, `app/(admin)/admin/orders/_components/PhotoUploader.tsx`, `app/(admin)/admin/orders/_components/PhotoCard.tsx`, `lib/photos/api.ts` | `photo/api/PhotoController.java`, `photo/service/PhotoService.java`, `photo/domain/PhotoRepository.java` | `photo/api/PhotoControllerIntegrationTest.java` |
| Auth / login | `/admin/login` | `app/(admin)/admin/login/page.tsx`, `components/auth/LoginForm.tsx`, `lib/auth/session.ts`, `lib/auth/types.ts` | `auth/api/AuthController.java`, `auth/service/AuthService.java`, `auth/rbac/RbacService.java` | `auth/api/AuthControllerIntegrationTest.java`, `auth/rbac/RbacIntegrationTest.java` |
| Bug report button | `/admin/*` (sidebar) | `components/admin/ReportIssueButton.tsx` (task 8-19), `components/admin/AdminSidebar.tsx`, `components/admin/AdminSidebarNav.tsx` | `messaging/api/HealthController.java` (trace flush) | `components/admin/__tests__/ReportIssueButton.test.tsx` (task 8-19) |

## OTel / Telemetry hot paths

| Module | Path | Role |
|---|---|---|
| Frontend OTel init | `instrumentation.ts` | Next.js `register()` — server-side OTel bootstrap |
| Browser OTel client | `lib/otel/browser-client.ts` | W3C traceparent injection into fetch headers |
| OTel OTLP proxy | `app/api/otlp/route.ts` | Forwards browser spans to Jaeger via `OTLP_ENDPOINT` |
| Browser init component | `components/admin/BrowserOtelInit.tsx` | Client component that calls `initBrowserOtel()` |
| Backend span helper | `messaging/service/MessagingSpanHelper.java` | OTel spans for outbound message dispatch |

## Audit / AuditLog hot paths

| Module | Path | Role |
|---|---|---|
| Aspect (intercepts) | `audit/AuditLogAspect.java` | `@Audited` pointcut — writes two-row audit entries |
| Write coordinator | `audit/AuditWriteCoordinator.java` | Transaction-safe write orchestration |
| Log writer | `audit/AuditLogWriter.java` | Persists `AuditLog` entity |
| Path-pattern curator | `audit/TimelineEventCurator.java` | Converts raw audit rows to `TimelineEvent` DTOs |
| Timeline API | `audit/api/AuditTimelineController.java` | `GET /api/admin/orders/:id/timeline` |
| Timeline service | `audit/AuditTimelineService.java` | Queries + assembles timeline |

## Demo seed hot paths

| Module | Path | Role |
|---|---|---|
| Seed runner | `demo/DemoSeedRunner.java` | `ApplicationRunner` — seeds clients + orders + threads on boot when `demo.seed=true` |
| Client factory | `demo/DemoClientFactory.java` | Creates realistic Polish client fixtures |
| Order factory | `demo/DemoOrderFactory.java` | Creates multi-status order fixtures |
| Thread factory | `demo/DemoThreadFactory.java` | Creates SMS/email thread fixtures |

## Messaging dispatch hot paths

| Module | Path | Role |
|---|---|---|
| Router | `messaging/service/MessageRouter.java` | Routes outbound messages to gateway; post-M6 split: ≤192 LOC |
| Dispatcher | `messaging/service/MessageGatewayDispatcher.java` | Calls provider gateway (email-gateway / sms-gateway libs) |
| Recipient resolver | `messaging/service/MessageRecipientResolver.java` | Resolves `Client` → phone/email from `OrderService` |
| Span helper | `messaging/service/MessagingSpanHelper.java` | OTel instrumentation for send / reconcile paths |
| Reconciler | `messaging/service/WebhookStatusReconciler.java` | Webhook → delivery status reconciliation |
| Trigger engine | `messaging/service/TriggerEngine.java` | Evaluates triggers on `OrderStatus` transition |
| Inbound parser | `messaging/service/InboundMessageService.java` | Parses inbound SMS/email webhook payloads |

## Cross-cutting: locked conventions and anti-patterns

> These are the gotchas that have burned us before. Always check before touching the relevant code.

| Concern | Rule | Where it lives |
|---|---|---|
| **Integration test naming** | Use `*IntegrationTest.java` ONLY. Files named `*IT.java` silently never run — Failsafe is in `<pluginManagement>`-only, not wired to `verify`. Source: M3 `PhotoControllerIT` 7-cases-never-executed incident. | All backend test files |
| **Frontend auth gate** | Use `proxy.ts` (NOT `middleware.ts`). Next 16 renamed the file; `middleware.ts` is silently ignored. | `apps/web/proxy.ts` |
| **Status change method** | Call `OrderService.changeStatus(...)`. Do NOT use `updateStatus` — that method does not exist. | `order/OrderService.java` |
| **PLN / NBSP locale** | `NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pl-PL"))` emits U+00A0 (NBSP) before "zł". Normalize NBSP→space server-side in `DashboardController`. Do NOT reformat PLN strings client-side. | `dashboard/api/DashboardController.java` |
| **Jackson boolean default** | `@JsonProperty(defaultValue="true")` is a no-op for primitive `boolean` in records. Use boxed `Boolean` + compact ctor normalization + `Boolean.TRUE.equals(req.field())` at read sites. | Any DTO with optional boolean fields |
| **@Audited SpEL on records** | `@Audited(parent="#result.X")` must use no-parens form (e.g. `#result.threadId`, NOT `#result.threadId()`). | Any `@Audited`-annotated service method returning a record |
| **@AuthenticationPrincipal** | Admin endpoints must use `authentication()` getter, not `user()`. | All admin API controllers |
| **OrderItemKind enum** | Values are Polish: `NAPRAWA`, `CUSTOM_BUTY`, `CUSTOM_KURTKA`. Not English. | `order/domain/OrderItemKind.java` |
| **`picked_up_at` semantics** | The real handover timestamp is `picked_up_at`, not `created_at` or `received_at`. | Order domain + messaging triggers |
| **Maven wrapper** | `mvnw` is in `backend/` root, not the repo root. Run as `./mvnw` from `backend/`. CI uses `backend/mvnw`. No bare `mvn` invocations. | `backend/mvnw` |
| **Flyway migrations** | Migration files live in `backend/app/src/main/resources/db/migration/`. Naming: `V<n>__<desc>.sql`. Current latest: V013 (message_thread uniqueness). Next new migration: V014. | `backend/app/src/main/resources/db/migration/` |
| **Controller package** | Package segment is `.api.` (non-negotiable): `com.drshoes.app.<feature>.api.<Controller>`. | Every controller class |
| **Structured logging** | Backend: `log.info("key=value ...")` with correlation id, actor, operation, entity id, outcome. Frontend: use `lib/log.ts` named-logger. No ad-hoc `console.log`. | `lib/log.ts`, every service/controller |
| **Granularity** | Java classes `< 120 LOC`; TS modules `< 80 LOC`. Split eagerly — precedent: `DashboardChartsController` extracted at 88 LOC. | Any new or modified class |
