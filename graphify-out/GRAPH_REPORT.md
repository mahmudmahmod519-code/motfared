# Graph Report - saas-crm  (2026-11-01)

## Corpus Check
- 400 files · ~131,521 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 7, .css 4, .woff2 2)

## Summary
- 2812 nodes · 7457 edges · 146 communities (101 shown, 45 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- AuthService
- LeadContactsService
- PlanSalesStatus
- @nestjs/typeorm
- @nestjs/mapped-types
- calls.controller.ts
- domain-history.e2e-spec.ts
- Role
- clinics.controller.ts
- LeadItemStatus
- companies.service.ts
- BillingService
- AssignmentStatus
- CreatePaymentDto
- plan-prices.controller.ts
- backend
- mysql
- backend/package.json
- Button
- frontend/package.json
- backend
- dependencies
- mobile-call-log.service.ts
- lead-item-call-centers.controller.ts
- legacy.ts
- ref_react
- lucide-react
- lifecycle.ts
- compilerOptions
- lead-items.controller.ts
- DashboardService
- typeorm
- web/package.json
- toCanonicalPhone
- plan-sales.controller.ts
- sensitive-data.interceptor.ts
- (app)/layout.tsx
- MobileAuthController
- scripts
- @nestjs/common
- @nestjs/common
- Payment
- CreateSubscriptionDto
- leads.controller.ts
- run-tests.ts
- compilerOptions
- app.module.ts
- AuthController
- Subscription
- mobile-lead-writes.service.ts
- MobileLeadWritesService
- nest-cli.json
- tsconfig.build.json
- Card
- next.config.js
- tenant-originals/tenant-isolation.e2e-spec.ts
- button.tsx
- google-sheets.service.ts
- index.ts
- RequirePermissionOrPlatform
- mobile-lead-writes.service.ts
- services.service.ts
- compilerOptions
- users.service.ts
- roles.service.ts
- Subscription
- CompanyMembership
- frontend
- company-membership.entity.ts
- TenantPrincipal
- Baseline1793470873396
- Booking
- Archive — spec-only code retired in Phase 1 (Nov 1, 2026)
- class-validator
- Billing1793471398598
- web/app/layout.tsx
- calls.service.ts
- RegisterDto
- LeadContactStatus
- mobile-auth.controller.ts
- app.setup.ts
- CustomerDecision
- DoctorMessage
- mobile-call-log.controller.ts
- WebhookEventsService
- contract.e2e-spec.ts
- DoctorRank
- @nestjs/typeorm
- CallLog1793477150115
- SubscriptionProviderRefsService
- MobileMessages1793476366378
- ChangePasswordDto
- RolesService
- CallOutcome
- README.md
- cairo-clock.ts
- Company
- 1793560000000-RenameSpecTables.ts
- 1793546581084-Rbac.ts
- MustChangePassword1793480000000
- RenameRoleKeys1793480100000
- Reminder
- company.entity.ts
- me.ts
- DomainCore1793560100000
- RbacService
- ENTITY_ONLY_MODULES.md
- (public)/login/page.tsx
- SyncCallLogDto
- DomainHistory1793560200000
- steps
- deploy
- with
- CreateRoleDto
- .handlePaymob
- env
- SubscriptionProviderRef
- jobs
- env
- lifecycle.parity.spec.ts
- [page]/page.tsx
- test-frontend
- TenantService
- CreateMobileLeadDto
- WebhookEventsController
- LoginDto
- paymob-hmac.ts
- UserDoctor
- deploy-preview
- on
- MembershipStatus
- test-backend-e2e
- SyncCallLogEntryDto
- AssignmentRole
- lifecycle.spec.ts

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 152 edges
2. `typeorm` - 129 edges
3. `Tenant` - 112 edges
4. `TenantPrincipal` - 110 edges
5. `Company` - 98 edges
6. `@nestjs/typeorm` - 90 edges
7. `tenantScope()` - 70 edges
8. `CompanyMembership` - 65 edges
9. `User` - 60 edges
10. `Subscription` - 54 edges

## Surprising Connections (you probably didn't know these)
- `What stays in `backend/` on purpose` --references--> `PlanSales`  [INFERRED]
  archive/2026-11-01-phase1-spec-only/README.md → backend/src/modules/plan-sales/entities/plan-sales.entity.ts
- `What stays in `backend/` on purpose` --references--> `AppModule`  [INFERRED]
  archive/2026-11-01-phase1-spec-only/README.md → backend/src/app.module.ts
- `CallsController` --references--> `TenantApi()`  [EXTRACTED]
  archive/2026-11-01-phase1-spec-only/backend/src/modules/calls/calls.controller.ts → backend/src/common/decorators/tenant-api.decorator.ts
- `GoogleSheetsController` --references--> `TenantApi()`  [EXTRACTED]
  archive/2026-11-01-phase1-spec-only/backend/src/modules/google-sheets/google-sheets.controller.ts → backend/src/common/decorators/tenant-api.decorator.ts
- `LeadContactsController` --references--> `TenantApi()`  [EXTRACTED]
  archive/2026-11-01-phase1-spec-only/backend/src/modules/lead-contacts/lead-contacts.controller.ts → backend/src/common/decorators/tenant-api.decorator.ts

## Import Cycles
- 2-file cycle: `backend/src/modules/rbac/entities/role-permission.entity.ts -> backend/src/modules/rbac/entities/role.entity.ts -> backend/src/modules/rbac/entities/role-permission.entity.ts`
- 2-file cycle: `backend/src/modules/calls/entities/call.entity.ts -> backend/src/modules/lead-contacts/entities/lead-contact.entity.ts -> backend/src/modules/calls/entities/call.entity.ts`
- 2-file cycle: `backend/src/modules/calls/entities/call.entity.ts -> backend/src/modules/lead-item-call-centers/entities/lead-item-call-center.entity.ts -> backend/src/modules/calls/entities/call.entity.ts`
- 2-file cycle: `backend/src/modules/lead-items/entities/lead-item.entity.ts -> backend/src/modules/plan-sales/entities/plan-sales.entity.ts -> backend/src/modules/lead-items/entities/lead-item.entity.ts`
- 2-file cycle: `backend/src/modules/lead-item-call-centers/entities/lead-item-call-center.entity.ts -> backend/src/modules/lead-items/entities/lead-item.entity.ts -> backend/src/modules/lead-item-call-centers/entities/lead-item-call-center.entity.ts`
- 2-file cycle: `backend/src/modules/lead-items/entities/lead-item.entity.ts -> backend/src/modules/leads/entities/lead.entity.ts -> backend/src/modules/lead-items/entities/lead-item.entity.ts`
- 2-file cycle: `backend/src/modules/lead-contacts/entities/lead-contact.entity.ts -> backend/src/modules/leads/entities/lead.entity.ts -> backend/src/modules/lead-contacts/entities/lead-contact.entity.ts`
- 2-file cycle: `backend/src/modules/billing-customers/entities/billing-customer.entity.ts -> backend/src/modules/companies/entities/company.entity.ts -> backend/src/modules/billing-customers/entities/billing-customer.entity.ts`
- 2-file cycle: `backend/src/modules/payments/entities/payment.entity.ts -> backend/src/modules/subscriptions/entities/subscription.entity.ts -> backend/src/modules/payments/entities/payment.entity.ts`
- 2-file cycle: `backend/src/modules/plan-prices/entities/plan-price.entity.ts -> backend/src/modules/plans/entities/plan.entity.ts -> backend/src/modules/plan-prices/entities/plan-price.entity.ts`
- 2-file cycle: `backend/src/modules/plan-prices/entities/plan-price.entity.ts -> backend/src/modules/subscriptions/entities/subscription.entity.ts -> backend/src/modules/plan-prices/entities/plan-price.entity.ts`
- 2-file cycle: `backend/src/modules/subscription-provider-refs/entities/subscription-provider-ref.entity.ts -> backend/src/modules/subscriptions/entities/subscription.entity.ts -> backend/src/modules/subscription-provider-refs/entities/subscription-provider-ref.entity.ts`
- 2-file cycle: `backend/src/modules/companies/entities/company.entity.ts -> backend/src/modules/company-memberships/entities/company-membership.entity.ts -> backend/src/modules/companies/entities/company.entity.ts`
- 2-file cycle: `backend/src/modules/companies/entities/company.entity.ts -> backend/src/modules/subscriptions/entities/subscription.entity.ts -> backend/src/modules/companies/entities/company.entity.ts`
- 2-file cycle: `backend/src/modules/company-memberships/entities/company-membership.entity.ts -> backend/src/modules/users/entities/user.entity.ts -> backend/src/modules/company-memberships/entities/company-membership.entity.ts`
- 3-file cycle: `backend/src/domain/core/team.entity.ts -> backend/src/modules/companies/entities/company.entity.ts -> backend/src/modules/company-memberships/entities/company-membership.entity.ts -> backend/src/domain/core/team.entity.ts`
- 5-file cycle: `backend/src/modules/calls/entities/call.entity.ts -> backend/src/modules/lead-contacts/entities/lead-contact.entity.ts -> backend/src/modules/leads/entities/lead.entity.ts -> backend/src/modules/lead-items/entities/lead-item.entity.ts -> backend/src/modules/lead-item-call-centers/entities/lead-item-call-center.entity.ts -> backend/src/modules/calls/entities/call.entity.ts`
- 5-file cycle: `backend/src/modules/calls/entities/call.entity.ts -> backend/src/modules/lead-item-call-centers/entities/lead-item-call-center.entity.ts -> backend/src/modules/lead-items/entities/lead-item.entity.ts -> backend/src/modules/leads/entities/lead.entity.ts -> backend/src/modules/lead-contacts/entities/lead-contact.entity.ts -> backend/src/modules/calls/entities/call.entity.ts`

## Communities (146 total, 45 thin omitted)

### Community 0 - "AuthService"
Cohesion: 0.14
Nodes (3): assertAcceptablePassword(), AuthService, MobileAuthService

### Community 1 - "LeadContactsService"
Cohesion: 0.09
Nodes (6): CreateLeadContactDto, UpdateLeadContactDto, LeadContactsController, isDuplicatePhone(), LeadContactsService, rethrowDuplicatePhone()

### Community 3 - "PlanSalesStatus"
Cohesion: 0.33
Nodes (6): PlanSalesStatus, ACTIVE, CANCELED, COMPLETED, DRAFT, PAUSED

### Community 4 - "@nestjs/typeorm"
Cohesion: 0.21
Nodes (4): @nestjs/testing@^10.0.0, supertest@^6.3.3, @nestjs/testing, supertest

### Community 5 - "@nestjs/mapped-types"
Cohesion: 0.11
Nodes (4): CreatePlanDto, UpdatePlanDto, PlansController, PlansService

### Community 6 - "calls.controller.ts"
Cohesion: 0.12
Nodes (3): agentOnly(), CallsController, CallsService

### Community 7 - "domain-history.e2e-spec.ts"
Cohesion: 0.11
Nodes (11): Campaign, Doctor, Service, Team, ClinicsModule, FIELDS, Scope, code() (+3 more)

### Community 8 - "Role"
Cohesion: 0.15
Nodes (4): Permission, Role, RolePermission, Who

### Community 9 - "clinics.controller.ts"
Cohesion: 0.08
Nodes (19): ARABIC_TO_LATIN, isReserved(), KNOWN_NAMES, MAX_SLUG, MIN_SLUG, normaliseSlug(), RESERVED_SLUGS, slugError() (+11 more)

### Community 10 - "LeadItemStatus"
Cohesion: 0.40
Nodes (5): LeadItemStatus, ACTIVE, CANCELED, COMPLETED, PAUSED

### Community 11 - "companies.service.ts"
Cohesion: 0.11
Nodes (9): CompaniesService, TENANT_EDITABLE, CreateCompanyDto, UpdateCompanyDto, CompanyStatus, ACTIVE, INACTIVE, PENDING (+1 more)

### Community 12 - "BillingService"
Cohesion: 0.08
Nodes (9): BillingController, BillingService, CreateManualPaymentRequestDto, ApproveManualPaymentRequestDto, RejectManualPaymentRequestDto, ManualPaymentStatus, APPROVED, PENDING_VERIFICATION (+1 more)

### Community 13 - "AssignmentStatus"
Cohesion: 0.40
Nodes (5): AssignmentStatus, ACTIVE, CANCELED, COMPLETED, PAUSED

### Community 15 - "plan-prices.controller.ts"
Cohesion: 0.09
Nodes (5): CreatePlanPriceDto, UpdatePlanPriceDto, PlanPricesController, PlanPricesModule, PlanPricesService

### Community 16 - "backend"
Cohesion: 0.05
Nodes (41): API_URL, build, container_name, depends_on, env_file, environment, networks, ports (+33 more)

### Community 17 - "mysql"
Cohesion: 0.09
Nodes (22): MYSQL_DATABASE, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, MYSQL_USER, interval, retries, test, timeout (+14 more)

### Community 18 - "backend/package.json"
Cohesion: 0.08
Nodes (35): author, description, devDependencies, jest@^29.5.0, @nestjs/cli@^10.0.0, @nestjs/schematics@^10.0.0, ts-jest@^29.1.0, ts-node@^10.9.1 (+27 more)

### Community 19 - "Button"
Cohesion: 0.09
Nodes (39): RegisterPage(), CompaniesPage(), MobileCallScreenPage(), RegisterForm, registerSchema, CallForm(), CallFormData, CallFormProps (+31 more)

### Community 20 - "frontend/package.json"
Cohesion: 0.06
Nodes (45): dependencies, axios@^1.6.0, clsx@^2.1.0, js-cookie@^3.0.5, lucide-react@^0.363.0, next@14.2.3, react@^18, react-dom@^18 (+37 more)

### Community 21 - "backend"
Cohesion: 0.06
Nodes (32): build, container_name, depends_on, env_file, environment, networks, ports, mysql (+24 more)

### Community 22 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, argon2@^0.31.0, class-validator@^0.14.0, googleapis@^126.0.0, mysql2@^3.0.0, @nestjs/common@^10.0.0, @nestjs/config@^3.0.0, @nestjs/core@^10.0.0 (+15 more)

### Community 23 - "mobile-call-log.service.ts"
Cohesion: 0.18
Nodes (13): callPhoneKey(), callPhoneTail(), phoneMatchSets(), latinDigits(), toLocalEgyptian(), CALL_DIRECTIONS, CALL_LOG_MAX_AGE_MS, CALL_LOG_MAX_FUTURE_MS (+5 more)

### Community 24 - "lead-item-call-centers.controller.ts"
Cohesion: 0.09
Nodes (5): CreateLeadItemCallCenterDto, UpdateLeadItemCallCenterDto, LeadItemCallCentersController, LeadItemCallCentersModule, LeadItemCallCentersService

### Community 25 - "legacy.ts"
Cohesion: 0.14
Nodes (24): vitest, FILES, INTENTIONAL, legacy(), ours(), stylesDir, customProps(), declarations() (+16 more)

### Community 26 - "ref_react"
Cohesion: 0.15
Nodes (16): DashboardLayout(), metadata, RootLayout(), Home(), Header(), HeaderProps, NavItem, navItems (+8 more)

### Community 27 - "lucide-react"
Cohesion: 0.21
Nodes (12): ContactsPage(), LeadsPage(), MobileDashboardPage(), UsersPage(), ContactListProps, LeadCard(), LeadCardProps, Modal() (+4 more)

### Community 28 - "lifecycle.ts"
Cohesion: 0.11
Nodes (22): Stamp, toInstant(), AttemptHistory, AttemptSummary, CALLS_PER_DAY, CLOSE_MIN_ATTEMPTS, CLOSE_MIN_DAYS, closeReason() (+14 more)

### Community 29 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+13 more)

### Community 30 - "lead-items.controller.ts"
Cohesion: 0.11
Nodes (5): CreateLeadItemDto, UpdateLeadItemDto, LeadItemsController, LeadItemsModule, LeadItemsService

### Community 32 - "typeorm"
Cohesion: 0.07
Nodes (9): OwnedKind, Call, LeadItemCallCenter, LeadItem, Lead, PlanSales, User, DENIED (+1 more)

### Community 33 - "web/package.json"
Cohesion: 0.09
Nodes (27): dependencies, next@14.2.35, react@18.3.1, react-dom@18.3.1, description, devDependencies, @types/node@^20.14.0, @types/react@^18.3.3 (+19 more)

### Community 34 - "toCanonicalPhone"
Cohesion: 0.14
Nodes (6): ARAB_COUNTRIES, extractPhone(), toCanonicalPhone(), toForeign(), MobileAuth1793473768793, MobileFoundation1793474574101

### Community 35 - "plan-sales.controller.ts"
Cohesion: 0.09
Nodes (5): CreatePlanSalesDto, UpdatePlanSalesDto, PlanSalesController, PlanSalesModule, PlanSalesService

### Community 36 - "sensitive-data.interceptor.ts"
Cohesion: 0.15
Nodes (8): rxjs@^7.8.0, ALLOW_FIELDS_KEY, AllowFields(), LoggingInterceptor, SENSITIVE_FIELDS, SensitiveDataInterceptor, stripSensitive(), rxjs

### Community 37 - "(app)/layout.tsx"
Cohesion: 0.16
Nodes (17): AppLayout(), dynamic, AppShell(), isCurrent(), COPY, NoAccess(), ShellFooter(), ICONS (+9 more)

### Community 39 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, format, lint, migration:generate, migration:revert, migration:run, start (+9 more)

### Community 40 - "@nestjs/common"
Cohesion: 0.07
Nodes (35): ALLOW_PASSWORD_CHANGE_KEY, CurrentEntitlement, Entitlement(), ENTITLEMENT_KEY, EntitlementRequirement, PermissionRequirement, REQUIRE_PERMISSION_KEY, Roles() (+27 more)

### Community 41 - "@nestjs/common"
Cohesion: 0.11
Nodes (3): BillingCustomersModule, BillingCustomersService, BillingCustomer

### Community 42 - "Payment"
Cohesion: 0.08
Nodes (11): Payment, PaymentStatus, FAILED, PARTIALLY_REFUNDED, PENDING, REFUNDED, SUCCEEDED, PaymentsModule (+3 more)

### Community 43 - "CreateSubscriptionDto"
Cohesion: 0.11
Nodes (3): CreateSubscriptionDto, UpdateSubscriptionDto, SubscriptionsService

### Community 44 - "leads.controller.ts"
Cohesion: 0.10
Nodes (4): CreateLeadDto, UpdateLeadDto, LeadsController, LeadsService

### Community 45 - "run-tests.ts"
Cohesion: 0.28
Nodes (5): generateReport(), main(), results, runTest(), TestResult

### Community 46 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 47 - "app.module.ts"
Cohesion: 0.06
Nodes (13): What stays in `backend/` on purpose, AppModule, TenantModule, BillingModule, ManualPaymentRequest, DashboardModule, MobileModule, PlansModule (+5 more)

### Community 48 - "AuthController"
Cohesion: 0.26
Nodes (3): AllowPasswordChange(), CurrentUser, AuthController

### Community 49 - "Subscription"
Cohesion: 0.06
Nodes (26): PlanPrice, PriceInterval, MONTH, YEAR, Plan, Subscription, SubscriptionStatus, ACTIVE (+18 more)

### Community 50 - "mobile-lead-writes.service.ts"
Cohesion: 0.12
Nodes (22): addDays(), cairoDayBounds(), cairoDayRange(), sqlStamp(), ARABIC_FOLD, escapeLike(), foldSql(), foldText() (+14 more)

### Community 52 - "nest-cli.json"
Cohesion: 0.40
Nodes (4): collection, compilerOptions, deleteOutDir, sourceRoot

### Community 53 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

### Community 54 - "Card"
Cohesion: 0.14
Nodes (18): LoginPage(), CompanyDetailPage(), MobileLoginPage(), PlanSaleDetailPage(), PlanSalesPage(), LoginForm, loginSchema, Card() (+10 more)

### Community 56 - "tenant-originals/tenant-isolation.e2e-spec.ts"
Cohesion: 0.10
Nodes (3): CASES, Spec, DENIED

### Community 59 - "button.tsx"
Cohesion: 0.16
Nodes (20): CallsPage(), LeadDetailPage(), CompanyList(), CompanyListProps, ContactList(), LeadList(), LeadListProps, Badge() (+12 more)

### Community 60 - "google-sheets.service.ts"
Cohesion: 0.13
Nodes (5): GoogleSheetsController, GoogleSheetsModule, GoogleSheetsService, LeadContactsModule, LeadsModule

### Community 61 - "index.ts"
Cohesion: 0.13
Nodes (15): DashboardPage(), ServicesPage(), SubscriptionsPage(), StatsCard(), StatsCardProps, api, dashboardApi, servicesApi (+7 more)

### Community 62 - "RequirePermissionOrPlatform"
Cohesion: 0.09
Nodes (6): RequirePermissionOrPlatform(), CompanyMembershipsController, CompanyMembershipsModule, CompanyMembershipsService, CreateCompanyMembershipDto, UpdateCompanyMembershipDto

### Community 63 - "mobile-lead-writes.service.ts"
Cohesion: 0.15
Nodes (18): ARABIC_WEEKDAYS, buildContext(), ContextBooking, ContextLead, DEFAULT_TEMPLATES, fill(), formatDateTime(), MessageTemplateDef (+10 more)

### Community 64 - "services.service.ts"
Cohesion: 0.08
Nodes (8): class-transformer@^0.5.0, CreateServiceDto, UpdateServiceDto, ServicesModule, code(), ServicesService, taken(), class-transformer

### Community 65 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 66 - "users.service.ts"
Cohesion: 0.08
Nodes (15): assertPhoneFree(), LIVE_STATUSES, phoneFields(), rethrowPhoneConflict(), PLATFORM_ADMIN, CreateUserDto, UpdateUserDto, UserStatus (+7 more)

### Community 67 - "roles.service.ts"
Cohesion: 0.23
Nodes (14): ADMIN, OWNER_KEY, PERMISSION_KEYS, PermissionDef, PERMISSIONS, SALES, SYSTEM_ROLE_KEYS, SYSTEM_ROLES (+6 more)

### Community 68 - "Subscription"
Cohesion: 0.09
Nodes (12): allowedFor(), DerivedState, deriveState(), EntitlementClass, ENTITLEMENTS, EntitlementState, OWNER_READ_ONLY_STATES, OWNER_ROLE (+4 more)

### Community 70 - "frontend"
Cohesion: 0.17
Nodes (11): build, container_name, env_file, environment, networks, ports, networks, saas-network (+3 more)

### Community 71 - "company-membership.entity.ts"
Cohesion: 0.15
Nodes (19): BIGINT, bigintAsNumber, CompanyRef(), IdPk(), IdRef(), UserRef(), Utc(), UtcNow() (+11 more)

### Community 72 - "TenantPrincipal"
Cohesion: 0.05
Nodes (9): Tenant, RequirePermission(), TenantPrincipal, tenantScope(), ClinicsController, MobileLeadWritesController, MobileLeadsController, RolesController (+1 more)

### Community 74 - "Booking"
Cohesion: 0.11
Nodes (10): Booking, CallResult, BOOKING_EVENT_KINDS, BOOKING_STATUSES, CALL_DIRECTIONS, CALL_RESULT_KINDS, CLAIM_RESULTS, HANDOVER_REASONS (+2 more)

### Community 75 - "Archive — spec-only code retired in Phase 1 (Nov 1, 2026)"
Cohesion: 0.22
Nodes (8): Archive — spec-only code retired in Phase 1 (Nov 1, 2026), `backend/src/modules/<module>/…` (40 files: controllers, services, DTOs, module files, unit specs), `backend/test/e2e/` and `backend/test/jest-e2e.json`, `backend/test/tenant-originals/`, `frontend/`, Restore (exact, per item), What is here, Why

### Community 76 - "class-validator"
Cohesion: 0.61
Nodes (3): PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, class-validator

### Community 78 - "web/app/layout.tsx"
Cohesion: 0.16
Nodes (11): metadata, viewport, LABELS, ThemeToggle(), effectiveTheme(), nextPreference(), parsePreference(), Theme (+3 more)

### Community 79 - "calls.service.ts"
Cohesion: 0.17
Nodes (5): CallsModule, CreateCallDto, UpdateCallDto, @nestjs/mapped-types@^2.1.1, @nestjs/mapped-types

### Community 81 - "LeadContactStatus"
Cohesion: 0.22
Nodes (9): LeadContactStatus, ARCHIVED, ASSIGNED, CONVERTED, DO_NOT_CONTACT, IN_PROGRESS, NEW, QUEUED (+1 more)

### Community 83 - "app.setup.ts"
Cohesion: 0.25
Nodes (9): cookie-parser@^1.4.6, helmet@^7.0.0, @nestjs/platform-express@^10.0.0, configureApp(), trustedProxyHops(), bootstrap(), cookie-parser, helmet (+1 more)

### Community 84 - "CustomerDecision"
Cohesion: 0.33
Nodes (6): CustomerDecision, ACCEPTED, INTERESTED, NEEDS_FOLLOW_UP, REJECTED, UNDECIDED

### Community 88 - "WebhookEventsService"
Cohesion: 0.26
Nodes (3): isDuplicateKey(), upper(), WebhookEventsService

### Community 89 - "contract.e2e-spec.ts"
Cohesion: 0.27
Nodes (8): available, clientRequests(), keysReadIn(), parserHelpers(), PENDING, RM, sourceText(), SRC

### Community 90 - "DoctorRank"
Cohesion: 0.50
Nodes (4): DoctorRank, PRIMARY, SECONDARY, TERTIARY

### Community 91 - "@nestjs/typeorm"
Cohesion: 0.18
Nodes (9): KNOWN_WEAK, resolveJwtSecret(), AuthModule, JwtStrategy, argon2, @nestjs/config, @nestjs/jwt, @nestjs/passport (+1 more)

### Community 93 - "SubscriptionProviderRefsService"
Cohesion: 0.13
Nodes (3): SubscriptionProviderRefsController, SubscriptionProviderRefsModule, SubscriptionProviderRefsService

### Community 98 - "CallOutcome"
Cohesion: 0.25
Nodes (8): CallOutcome, ANSWERED, BUSY, CALLBACK_REQUESTED, NO_ANSWER, REJECTED, VOICEMAIL, WRONG_NUMBER

### Community 100 - "cairo-clock.ts"
Cohesion: 0.19
Nodes (13): cairoDateTime(), cairoDay(), cairoDayOfStamp(), cairoMonth(), cairoMonthBounds(), cairoOffsetMs(), cairoParts, cairoWallStamp() (+5 more)

### Community 103 - "Company"
Cohesion: 0.08
Nodes (6): Column, LeadPhone, BookingEvent, ClaimAttempt, Company, CompanySetting

### Community 104 - "1793560000000-RenameSpecTables.ts"
Cohesion: 0.29
Nodes (7): FK_RENAMES, hasIndex(), INDEX_RENAMES, original(), RENAMES, RenameSpecTables1793560000000, wasRenamed()

### Community 109 - "company.entity.ts"
Cohesion: 0.05
Nodes (10): bigintAsNumber, CallLogEntry, CallResult, Doctor, UserDoctor, LeadContact, Service, ServiceStatus (+2 more)

### Community 110 - "me.ts"
Cohesion: 0.17
Nodes (12): ChangePasswordPage(), dynamic, ChangePasswordForm(), API_URL, getMe(), Access, Entitlement, interpretMe() (+4 more)

### Community 114 - "(public)/login/page.tsx"
Cohesion: 0.26
Nodes (12): dynamic, LoginPage(), LoginForm(), submit(), loginErrorMessage(), gate(), isPublicPath(), loginUrl() (+4 more)

### Community 118 - "steps"
Cohesion: 0.20
Nodes (15): steps, steps, name, needs, runs-on, steps, docker-build, test-backend (+7 more)

### Community 119 - "deploy"
Cohesion: 0.17
Nodes (14): build, deploy, builder, dockerfilePath, healthcheckPath, healthcheckTimeout, restartPolicyMaxRetries, restartPolicyType (+6 more)

### Community 120 - "with"
Cohesion: 0.15
Nodes (13): with, cache, cache-dependency-path, cache-from, cache-to, context, environment, file (+5 more)

### Community 121 - "CreateRoleDto"
Cohesion: 0.27
Nodes (3): CreateRoleDto, UpdateRoleDto, ROLE_KEY_PATTERN

### Community 123 - "env"
Cohesion: 0.18
Nodes (11): DB_DATABASE, DB_HOST, DB_PASSWORD, DB_PORT, DB_USERNAME, JWT_SECRET, NEXT_PUBLIC_API_URL, NODE_ENV (+3 more)

### Community 126 - "jobs"
Cohesion: 0.20
Nodes (9): if, name, needs, runs-on, env, NODE_VERSION, jobs, deploy-production (+1 more)

### Community 127 - "env"
Cohesion: 0.20
Nodes (10): MYSQL_DATABASE, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, MYSQL_USER, env, image, options, ports (+2 more)

### Community 128 - "lifecycle.parity.spec.ts"
Cohesion: 0.22
Nodes (4): reflect-metadata@^0.1.13, available, legacyDir, reflect-metadata

### Community 129 - "[page]/page.tsx"
Cohesion: 0.36
Nodes (5): OverviewPage(), dynamicParams, Page(), PagePlaceholder(), NAV

### Community 130 - "test-frontend"
Cohesion: 0.25
Nodes (8): run, test-frontend, working-directory, defaults, defaults, defaults, name, runs-on

### Community 132 - "CreateMobileLeadDto"
Cohesion: 0.48
Nodes (3): CreateMobileLeadDto, UpdateMobileLeadDto, WrittenContactDto

### Community 135 - "paymob-hmac.ts"
Cohesion: 0.60
Nodes (4): PAYMOB_HMAC_FIELDS, paymobHmac(), pick(), verifyPaymobHmac()

### Community 138 - "deploy-preview"
Cohesion: 0.40
Nodes (5): if, name, needs, runs-on, deploy-preview

### Community 139 - "on"
Cohesion: 0.40
Nodes (5): on, pull_request, push, branches, branches

### Community 140 - "MembershipStatus"
Cohesion: 0.50
Nodes (4): MembershipStatus, ACTIVE, INACTIVE, SUSPENDED

### Community 141 - "test-backend-e2e"
Cohesion: 0.50
Nodes (4): test-backend-e2e, name, runs-on, steps

### Community 143 - "AssignmentRole"
Cohesion: 0.67
Nodes (3): AssignmentRole, PRIMARY, SECONDARY

## Knowledge Gaps
- **69 isolated node(s):** `PENDING_VERIFICATION`, `APPROVED`, `REJECTED`, `ANSWERED`, `NO_ANSWER` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `@nestjs/common` to `LeadContactsService`, `@nestjs/typeorm`, `@nestjs/mapped-types`, `domain-history.e2e-spec.ts`, `services.service.spec.ts`, `clinics.controller.ts`, `Role`, `companies.service.ts`, `plan-prices.controller.ts`, `backend/package.json`, `dependencies`, `mobile-call-log.service.ts`, `lead-item-call-centers.controller.ts`, `lead-items.controller.ts`, `typeorm`, `plan-sales.controller.ts`, `sensitive-data.interceptor.ts`, `@nestjs/common`, `Payment`, `CreateSubscriptionDto`, `leads.controller.ts`, `app.module.ts`, `Subscription`, `mobile-lead-writes.service.ts`, `tenant-originals/tenant-isolation.e2e-spec.ts`, `google-sheets.service.ts`, `RequirePermissionOrPlatform`, `services.service.ts`, `users.service.ts`, `roles.service.ts`, `company-membership.entity.ts`, `TenantPrincipal`, `class-validator`, `calls.service.ts`, `app.setup.ts`, `@nestjs/typeorm`, `SubscriptionProviderRefsService`, `company.entity.ts`, `calls.controller.ts`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **What connects `PENDING_VERIFICATION`, `APPROVED`, `REJECTED` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AuthService` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._
- **Why does `Column` connect `Company` to `typeorm`, `CompanyMembership`, `company-membership.entity.ts`, `domain-history.e2e-spec.ts`, `UserDoctor`, `Booking`, `@nestjs/common`, `Reminder`, `company.entity.ts`, `Payment`, `app.module.ts`, `Role`, `Subscription`, `DoctorMessage`, `button.tsx`, `SubscriptionProviderRef`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Should `LeadContactsService` be split into smaller, more focused modules?**
  _Cohesion score 0.08585858585858586 - nodes in this community are weakly interconnected._
- **Why does `typeorm` connect `typeorm` to `lifecycle.parity.spec.ts`, `LeadContactsService`, `@nestjs/typeorm`, `@nestjs/mapped-types`, `domain-history.e2e-spec.ts`, `services.service.spec.ts`, `clinics.controller.ts`, `Role`, `companies.service.ts`, `plan-prices.controller.ts`, `backend/package.json`, `dependencies`, `mobile-call-log.service.ts`, `lead-item-call-centers.controller.ts`, `lead-items.controller.ts`, `toCanonicalPhone`, `plan-sales.controller.ts`, `@nestjs/common`, `Payment`, `CreateSubscriptionDto`, `leads.controller.ts`, `run-tests.ts`, `app.module.ts`, `Subscription`, `mobile-lead-writes.service.ts`, `tenant-originals/tenant-isolation.e2e-spec.ts`, `RequirePermissionOrPlatform`, `services.service.ts`, `users.service.ts`, `roles.service.ts`, `company-membership.entity.ts`, `Baseline1793470873396`, `Billing1793471398598`, `calls.service.ts`, `@nestjs/typeorm`, `CallLog1793477150115`, `SubscriptionProviderRefsService`, `MobileMessages1793476366378`, `1793560000000-RenameSpecTables.ts`, `1793546581084-Rbac.ts`, `MustChangePassword1793480000000`, `RenameRoleKeys1793480100000`, `company.entity.ts`, `DomainCore1793560100000`, `DomainHistory1793560200000`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Should `@nestjs/mapped-types` be split into smaller, more focused modules?**
  _Cohesion score 0.10634920634920635 - nodes in this community are weakly interconnected._