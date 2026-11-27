# MyTodoApp: Specification

> **Status:** Draft v1, written by the architect agent (setup step 4.1). Awaiting owner approval (step 4.3).
> This file is the single source of truth for *what* we build. Frontend and backend agents build against the API contract below, so keep it precise.

## 1. Overview

MyTodoApp is a personal task manager for individuals. A user creates an account with email and password, organises tasks into lists, gives each task a title, optional notes, an optional due date and a priority, and checks tasks off when done. Three smart views (**Today**, **Upcoming**, **Completed**) show tasks across all lists, using the user's own (browser) time zone. The app is responsive (phone, tablet, desktop) and installable as a PWA that can be **viewed** offline. The v1 goal is a small, secure, well-tested product that runs cheaply on Azure Container Apps + Azure SQL serverless.

## 2. Features (v1)

IDs (e.g. `A1`) are used to reference stories from GitHub issues. Everything in this section is **in v1**; excluded items are listed in section 8.

### 2.1 Accounts
| ID | User story |
|---|---|
| A1 | As a visitor, I can register with my email and a password, so that I have a private account. After registering I am signed in automatically. |
| A2 | As a user, I can sign in with my email and password, and I stay signed in on this device (persistent cookie, 14-day sliding expiry). |
| A3 | As a user, I can sign out, which ends my session and clears data cached on this device. |
| A4 | As a user, I can see which account I'm signed in with (email in the account menu). |
| A5 | As a user, I only ever see my own lists and tasks. |

### 2.2 Lists
| ID | User story |
|---|---|
| L1 | As a new user, I get a default list called **Inbox** so I can add tasks immediately. The Inbox cannot be renamed or deleted. |
| L2 | As a user, I can create a list with a name that is unique among my lists. |
| L3 | As a user, I can see all my lists with the number of open tasks in each. |
| L4 | As a user, I can rename a list. |
| L5 | As a user, I can delete a list after confirming; all its tasks are deleted too. |

### 2.3 Tasks
| ID | User story |
|---|---|
| T1 | As a user, I can add a task to a list with a title and, optionally, notes, a due date and a priority (default Medium). |
| T2 | As a user, I can see a list's open tasks, and expand its completed tasks. |
| T3 | As a user, I can edit a task's title, notes, due date, priority and list (move it to another list). |
| T4 | As a user, I can mark a task as done and undo that (mark as not done). |
| T5 | As a user, I can delete a task after confirming. |
| T6 | As a user, I can see at a glance a task's priority, due date and whether it is overdue. |

### 2.4 Filters (smart views)
| ID | User story |
|---|---|
| F1 | As a user, I can open **Today** to see open tasks due today **and overdue** open tasks (overdue shown separately and marked), across all lists. |
| F2 | As a user, I can open **Upcoming** to see open tasks due after today, across all lists, grouped by date. |
| F3 | As a user, I can open **Completed** to see done tasks across all lists, most recently completed first. |
| F4 | "Today" is based on my device's time zone. |

### 2.5 PWA
| ID | User story |
|---|---|
| P1 | As a user, I can install the app on my phone or desktop and launch it like a native app. |
| P2 | As a user, when offline I can open the app and view the lists and tasks I last loaded. |
| P3 | As a user, when offline I see a clear offline indicator, and all editing controls are disabled. |
| P4 | As a user, when a new version is deployed, I'm told and can reload to update. |

## 3. Data model

General rules:
- **Ids** are `Guid` (generate with `Guid.CreateVersion7()` for index-friendly ordering). Serialized as lowercase UUID strings.
- **Timestamps** (`CreatedAt`, `UpdatedAt`, `CompletedAt`) are UTC (`DateTime` with `Kind = Utc`, SQL `datetime2`). Set by the server from `TimeProvider`/`IClock`, never from client input. JSON format: ISO 8601 with `Z`, e.g. `"2026-11-27T09:30:00.123Z"`.
- **Due dates** are dates without time (`DateOnly`, SQL `date`). JSON format: `"YYYY-MM-DD"`.
- **Ownership:** every `TaskList` and every `TodoTask` belongs to exactly one user. Every query filters by the current user's id.
- Strings are trimmed by the server before validation and storage. Optional strings that are empty or whitespace after trimming are stored as `null`.
- Text comparisons for uniqueness are **case-insensitive** (Azure SQL default collation `SQL_Latin1_General_CP1_CI_AS`).

### 3.1 User (ASP.NET Core Identity)
Identity's user entity with **`Guid` keys** (`IdentityUser<Guid>`), stored in the same Azure SQL database and `DbContext`. No custom profile fields in v1.

| Field | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| Email | string(256) | Required, unique (`RequireUniqueEmail = true`). |
| UserName | string(256) | Same as Email (set by `MapIdentityApi` register). |
| PasswordHash, SecurityStamp, ConcurrencyStamp, Lockout*, AccessFailedCount, ... | Identity defaults | Managed by Identity only. |

### 3.2 TaskList
| Field | Type | Required | Constraints / default |
|---|---|---|---|
| Id | Guid | yes | PK |
| UserId | Guid | yes | FK → User. **Cascade delete.** |
| Name | string(100) | yes | 1–100 chars after trim. Unique per user (case-insensitive): unique index on `(UserId, Name)`. |
| IsDefault | bool | yes | `true` only for the Inbox. Exactly one default list per user. |
| CreatedAt | DateTime (UTC) | yes | Set on create. |
| UpdatedAt | DateTime (UTC) | yes | Set on create and on every change. |

### 3.3 TodoTask
| Field | Type | Required | Constraints / default |
|---|---|---|---|
| Id | Guid | yes | PK |
| UserId | Guid | yes | FK → User, **no cascade** (`NoAction`; avoids SQL Server multiple cascade paths). Denormalised owner, always equal to the list's `UserId`. |
| ListId | Guid | yes | FK → TaskList. **Cascade delete** (deleting a list deletes its tasks). |
| Title | string(200) | yes | 1–200 chars after trim. |
| Notes | string(2000) | no | Max 2000 chars; `null` when empty. Plain text (no Markdown/HTML rendering). |
| DueDate | DateOnly | no | `null` = no due date. Allowed range 2000-01-01 to 2099-12-31 (past dates allowed). |
| Priority | enum `TaskPriority` | yes | `Low = 1`, `Medium = 2`, `High = 3`. Default `Medium`. Stored as int. JSON: `"low"`, `"medium"`, `"high"`. |
| IsCompleted | bool | yes | Default `false`. |
| CompletedAt | DateTime (UTC) | no | Set when completed; cleared (`null`) when un-completed. `null` whenever `IsCompleted = false`. |
| CreatedAt | DateTime (UTC) | yes | Set on create. |
| UpdatedAt | DateTime (UTC) | yes | Set on create and on every change (including complete/uncomplete). |

Suggested indexes: `TodoTask (UserId, IsCompleted, DueDate)`, `TodoTask (ListId, IsCompleted)`, `TodoTask (UserId, IsCompleted, CompletedAt)`.

### 3.4 Relationships and decisions
- User 1 → * TaskList, TaskList 1 → * TodoTask, User 1 → * TodoTask (denormalised).
- **Every task belongs to a list.** Each user gets an **Inbox** list (`IsDefault = true`, `Name = "Inbox"`) created **atomically with the user at registration** (same transaction; e.g. the Infrastructure `DbContext` adds the Inbox when a new user is added, since `MapIdentityApi`'s register endpoint can't be extended directly. Exact mechanism is decided in step 4.2). Why: one simple invariant (no "list-less" tasks, no nullable `ListId`), every task is visible in exactly one list view, and quick-add from Today has an obvious home.
- Deleting a list deletes all its tasks (database cascade). The Inbox cannot be deleted, so the user always has at least one list.
- Limits (to keep v1 free of pagination): **max 100 lists per user**. Task count is not capped, but collection endpoints return at most **500 tasks** (see 4.1).
- No soft delete, no audit history, no optimistic concurrency in v1 (last write wins).

## 4. API contract

### 4.1 Conventions
- Base path `/api/v1`. JSON request/response bodies, camelCase properties, enums as camelCase strings. Unknown JSON properties are ignored.
- **Auth:** all endpoints require an authenticated user (Identity application cookie) **unless marked "anonymous"**. Unauthenticated requests get **`401`**, never a redirect.
- **Errors** are ProblemDetails (RFC 9457), `Content-Type: application/problem+json`:
  - `400` validation: `ValidationProblemDetails` with `errors` keyed by camelCase field name, e.g.
    ```json
    { "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1", "title": "One or more validation errors occurred.", "status": 400,
      "errors": { "title": ["The title must be between 1 and 200 characters."] } }
    ```
  - `404` not found **or owned by another user** (identical response, never leak existence). Route ids that are not valid GUIDs also give `404` (`{id:guid}` route constraint).
  - `409` conflict (duplicate list name, list limit reached, Inbox rename/delete).
  - `429` too many requests (rate-limited auth endpoints), with `Retry-After` header.
  - `500` generic: `title: "An unexpected error occurred."`, no exception details.
- `201 Created` responses include a `Location` header (relative URL) and the created resource in the body. Updates and deletes return `204 No Content`.
- Collections are wrapped in an object so pagination can be added later without breaking clients. **No pagination in v1.** Task collections return at most 500 items in the view's sort order; `truncated: true` means more exist.
- "Error statuses" in the tables below omit `401` (applies to every authenticated endpoint) and `500` (always possible).

### 4.2 Shared DTOs

**TaskListDto**
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| name | string | |
| isDefault | boolean | `true` for Inbox |
| openTaskCount | integer | Number of tasks in the list with `isCompleted = false` |
| createdAt | string (ISO 8601 UTC) | |
| updatedAt | string (ISO 8601 UTC) | |

**TaskDto**
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| listId | string (uuid) | |
| listName | string | Name of the owning list (for smart views) |
| title | string | |
| notes | string \| null | |
| dueDate | string (`YYYY-MM-DD`) \| null | |
| priority | `"low"` \| `"medium"` \| `"high"` | |
| isCompleted | boolean | |
| completedAt | string (ISO 8601 UTC) \| null | |
| createdAt | string (ISO 8601 UTC) | |
| updatedAt | string (ISO 8601 UTC) | |

**TaskCollectionDto**: `{ "items": TaskDto[], "truncated": boolean }`
**TaskListCollectionDto**: `{ "items": TaskListDto[] }`

### 4.3 Endpoint overview
| # | Method | Route | Auth | Success | Purpose |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/register` | anonymous | 200 | Register (Identity) |
| 2 | POST | `/api/v1/auth/login?useCookies=true` | anonymous | 200 | Sign in, sets cookie (Identity) |
| 3 | POST | `/api/v1/auth/logout` | anonymous | 204 | Sign out, clears cookie |
| 4 | GET | `/api/v1/auth/me` | required | 200 | Current user |
| 5 | GET | `/api/v1/task-lists` | required | 200 | All my lists |
| 6 | GET | `/api/v1/task-lists/{listId}` | required | 200 | One list |
| 7 | POST | `/api/v1/task-lists` | required | 201 | Create list |
| 8 | PUT | `/api/v1/task-lists/{listId}` | required | 204 | Rename list |
| 9 | DELETE | `/api/v1/task-lists/{listId}` | required | 204 | Delete list + its tasks |
| 10 | GET | `/api/v1/task-lists/{listId}/tasks` | required | 200 | Tasks of a list |
| 11 | POST | `/api/v1/task-lists/{listId}/tasks` | required | 201 | Create task in list |
| 12 | GET | `/api/v1/tasks/{taskId}` | required | 200 | One task |
| 13 | PUT | `/api/v1/tasks/{taskId}` | required | 204 | Update task (incl. move) |
| 14 | DELETE | `/api/v1/tasks/{taskId}` | required | 204 | Delete task |
| 15 | POST | `/api/v1/tasks/{taskId}/complete` | required | 204 | Mark done |
| 16 | POST | `/api/v1/tasks/{taskId}/uncomplete` | required | 204 | Mark not done |
| 17 | GET | `/api/v1/tasks/today?timeZone=` | required | 200 | Today view (incl. overdue) |
| 18 | GET | `/api/v1/tasks/upcoming?timeZone=` | required | 200 | Upcoming view |
| 19 | GET | `/api/v1/tasks/completed` | required | 200 | Completed view |
| 20 | GET | `/health` | anonymous | 200 | Liveness/readiness probe |

### 4.4 Accounts (`/api/v1/auth`)
Endpoints 1–2 are the built-in ASP.NET Core Identity API endpoints (`app.MapGroup("/api/v1/auth").MapIdentityApi<User>()`); their request/response shapes are defined by the framework and summarised here. `auth` is a deliberate exception to the plural-noun route rule. Endpoints 3–4 are ours.

The other endpoints that `MapIdentityApi` maps (`/refresh`, `/confirmEmail`, `/resendConfirmationEmail`, `/forgotPassword`, `/resetPassword`, `/manage/info`, `/manage/2fa`) are **not part of v1 and must return `404`** (e.g. via an allow-list endpoint filter on the group). Bearer-token login (`useCookies` absent/false) is not supported: the API authenticates with the Identity application cookie only.

**1. POST `/api/v1/auth/register`** (anonymous, rate-limited)
| | |
|---|---|
| Request | `{ "email": string, "password": string }` |
| Validation | `email`: required, valid email, max 256. `password`: see password rules in 5.5. |
| Success | `200 OK`, empty body. The user and their Inbox list are created. The user is **not** signed in; the client calls login next. |
| Errors | `400` ValidationProblemDetails; `errors` keys are Identity error codes, e.g. `DuplicateUserName`, `InvalidEmail`, `PasswordTooShort`, `PasswordRequiresDigit`, `PasswordRequiresUpper`, `PasswordRequiresLower`. `429`. |

**2. POST `/api/v1/auth/login?useCookies=true`** (anonymous, rate-limited)
| | |
|---|---|
| Request | `{ "email": string, "password": string }` (`twoFactorCode`/`twoFactorRecoveryCode` are not used in v1) |
| Success | `200 OK`, empty body, `Set-Cookie` with the auth cookie (see 7.1). The client always sends `useCookies=true` and never `useSessionCookies`. |
| Errors | `401` ProblemDetails with `detail` `"Failed"` (wrong email/password) or `"LockedOut"`. `429`. The UI shows a generic "Invalid email or password." for `Failed`. |

**3. POST `/api/v1/auth/logout`** (anonymous, so it is idempotent)
| | |
|---|---|
| Request | No body. |
| Success | `204 No Content`. Signs out (`SignInManager.SignOutAsync`), the cookie is expired. Also `204` if not signed in. |

**4. GET `/api/v1/auth/me`**
| | |
|---|---|
| Success | `200 OK` `{ "id": string (uuid), "email": string }` |
| Errors | `401` if not signed in (the frontend uses this to decide whether to show the login page). |

### 4.5 Task lists (`/api/v1/task-lists`)

**5. GET `/api/v1/task-lists`**
- `200 OK` `TaskListCollectionDto`, sorted: Inbox first, then `name` ascending (case-insensitive).

**6. GET `/api/v1/task-lists/{listId}`**
- `200 OK` `TaskListDto`. Errors: `404`.

**7. POST `/api/v1/task-lists`**
| | |
|---|---|
| Request | `{ "name": string }`: required, 1–100 chars after trim. |
| Success | `201 Created`, `Location: /api/v1/task-lists/{id}`, body `TaskListDto` (`isDefault: false`, `openTaskCount: 0`). |
| Errors | `400` validation. `409` name already used by one of my lists (case-insensitive, after trim): `detail: "A list with this name already exists."`. `409` limit reached: `detail: "You can have at most 100 lists."` |

**8. PUT `/api/v1/task-lists/{listId}`** (rename)
| | |
|---|---|
| Request | `{ "name": string }`: required, 1–100 chars after trim. |
| Success | `204 No Content`. Renaming to the same name (any casing) succeeds. |
| Errors | `400` validation. `404`. `409` duplicate name. `409` list is the Inbox: `detail: "The Inbox list cannot be renamed."` |

**9. DELETE `/api/v1/task-lists/{listId}`**
| | |
|---|---|
| Success | `204 No Content`. The list and all its tasks are deleted. |
| Errors | `404`. `409` list is the Inbox: `detail: "The Inbox list cannot be deleted."` |

### 4.6 Tasks

**10. GET `/api/v1/task-lists/{listId}/tasks?status=open|completed|all`**
| | |
|---|---|
| Query | `status`: optional, default `open`. `open` = `isCompleted = false`; `completed` = `isCompleted = true`; `all` = both. |
| Success | `200 OK` `TaskCollectionDto`, sorted per 5.4 (list view). |
| Errors | `400` invalid `status`. `404` list not found / not owned. |

**11. POST `/api/v1/task-lists/{listId}/tasks`**
| | |
|---|---|
| Request | `{ "title": string, "notes"?: string \| null, "dueDate"?: "YYYY-MM-DD" \| null, "priority"?: "low" \| "medium" \| "high" }` |
| Validation | `title` required, 1–200 after trim. `notes` max 2000. `dueDate` valid date within 2000-01-01..2099-12-31. `priority` defaults to `"medium"`; invalid value → 400. |
| Success | `201 Created`, `Location: /api/v1/tasks/{id}`, body `TaskDto` (`isCompleted: false`, `completedAt: null`). |
| Errors | `400` validation. `404` list not found / not owned. |

**12. GET `/api/v1/tasks/{taskId}`**
- `200 OK` `TaskDto`. Errors: `404`.

**13. PUT `/api/v1/tasks/{taskId}`** (full replacement of editable fields)
| | |
|---|---|
| Request | `{ "title": string, "notes": string \| null, "dueDate": "YYYY-MM-DD" \| null, "priority": "low" \| "medium" \| "high", "listId": string (uuid) }`. All properties must be present; `notes`/`dueDate` may be `null` to clear. Completion state is **not** changed here. |
| Validation | As in 11; `priority` and `listId` required. |
| Success | `204 No Content`. If `listId` differs, the task moves to that list. |
| Errors | `400` validation. `404` task not found / not owned. `404` target list not found / not owned (`detail: "List not found."`). |

**14. DELETE `/api/v1/tasks/{taskId}`**
- `204 No Content`. Errors: `404`.

**15. POST `/api/v1/tasks/{taskId}/complete`**
- No body. Sets `isCompleted = true`, `completedAt = now (UTC)`. **Idempotent:** if already completed, returns `204` and leaves `completedAt` unchanged.
- `204 No Content`. Errors: `404`.

**16. POST `/api/v1/tasks/{taskId}/uncomplete`**
- No body. Sets `isCompleted = false`, `completedAt = null`. Idempotent.
- `204 No Content`. Errors: `404`.

### 4.7 Smart views

`timeZone` is an IANA time zone id (e.g. `Europe/Paris`, URL-encoded as `Europe%2FParis`), taken by the frontend from `Intl.DateTimeFormat().resolvedOptions().timeZone` (fallback `"UTC"`). The server resolves it with `TimeZoneInfo.FindSystemTimeZoneById` (IANA ids work on Linux containers and with ICU on Windows).

**17. GET `/api/v1/tasks/today?timeZone={iana}`**
- `200 OK` `TaskCollectionDto`: open tasks with `dueDate <= today` (includes overdue). Sorted per 5.4.
- Errors: `400` if `timeZone` is missing or not a known time zone (`errors.timeZone`).

**18. GET `/api/v1/tasks/upcoming?timeZone={iana}`**
- `200 OK` `TaskCollectionDto`: open tasks with `dueDate > today`. Sorted per 5.4.
- Errors: `400` as in 17.

**19. GET `/api/v1/tasks/completed`**
- `200 OK` `TaskCollectionDto`: all completed tasks, most recently completed first (max 500; `truncated` signals more).
- No time zone needed.

### 4.8 Health
**20. GET `/health`** (anonymous, outside `/api/v1`)
- `200 OK`, plain text `Healthy`. Used by Container Apps liveness and readiness probes.
- It does **not** query the database: a DB check on every probe would keep Azure SQL serverless from auto-pausing.

## 5. Business rules

### 5.1 "Today" in the user's time zone
- `now = TimeProvider.GetUtcNow()`; `today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, tz).DateTime)`, where `tz` is the `timeZone` query parameter.
- The day changes at local midnight in `tz`. DST is handled by the conversion. Because due dates have no time component, there are no other boundary cases.
- The server is the authority for which tasks are in Today/Upcoming. The frontend uses the same browser time zone to label tasks (Overdue / Today / Tomorrow).

### 5.2 View definitions
| View | Includes (all conditions, current user only) |
|---|---|
| **Today** | `isCompleted = false` AND `dueDate IS NOT NULL` AND `dueDate <= today`. |
| ↳ Overdue (subset of Today) | `dueDate < today`. Shown in a separate "Overdue" section at the top and marked as overdue. |
| **Upcoming** | `isCompleted = false` AND `dueDate > today`. **No horizon**: every future-dated task appears, grouped by date. Why: a 7-day horizon would hide tasks due later from every smart view, and the list stays short anyway because it's limited to dated, open tasks. |
| **Completed** | `isCompleted = true`, any due date (or none), any list. |
| **List view** | All tasks with `listId = X`, filtered by `status` (open by default). The only place where open tasks **without a due date** appear. |

Tasks without a due date never appear in Today or Upcoming. They appear in their list and, once done, in Completed.

### 5.3 Overdue
A task is overdue when `isCompleted = false` AND `dueDate < today` (user's time zone). Overdue is displayed (red label "Overdue" + the date) in Today and in list views. It is never stored.

### 5.4 Sorting (deterministic; final tie-breaker is always `id` ascending)
| View | Order |
|---|---|
| Today | `dueDate` asc (oldest overdue first), then `priority` desc (High → Low), then `createdAt` asc |
| Upcoming | `dueDate` asc, then `priority` desc, then `createdAt` asc |
| Completed | `completedAt` desc |
| List view, open tasks | `dueDate` asc with **no due date last**, then `priority` desc, then `createdAt` asc |
| List view, completed tasks | `completedAt` desc |
| List view, `status=all` | open tasks first (order above), then completed tasks (order above) |
| Lists | Inbox first, then `name` asc (case-insensitive) |

### 5.5 Validation rules
| Field | Rule |
|---|---|
| Email | Required, valid email format, max 256, unique (case-insensitive). |
| Password | Min **8** characters, at least one **uppercase**, one **lowercase** and one **digit**; non-alphanumeric not required (`RequireNonAlphanumeric = false`, `RequiredUniqueChars = 1`). No max beyond framework defaults. |
| List name | Required, 1–100 chars after trim, unique per user (case-insensitive, after trim). Max 100 lists per user. |
| Inbox | Exactly one per user, created at registration, cannot be renamed or deleted. |
| Task title | Required, 1–200 chars after trim (whitespace-only is invalid). |
| Task notes | Optional, max 2000 chars; empty/whitespace → `null`. |
| Due date | Optional; `YYYY-MM-DD`; 2000-01-01 to 2099-12-31; past dates allowed. |
| Priority | `low` / `medium` / `high`; default `medium` on create; required on update. |
| Moving a task | Target list must exist and belong to the current user. |
| Completion | `completedAt` is set only by `complete`, cleared only by `uncomplete`. Editing a completed task via PUT keeps it completed. |

Where validation lives: format/length rules are DataAnnotations (plus `IValidatableObject` for trimming/whitespace rules) on request records; rules that need the database (name uniqueness, list limit, Inbox protection, list ownership) are in handlers and throw domain exceptions.

### 5.6 Account security rules
- Lockout: Identity defaults: **5** failed logins → locked out for **5 minutes**.
- Rate limit (built-in ASP.NET Core rate limiter, no extra package): `register` and `login` share a fixed window of **10 requests per minute per client IP** → `429`. Client IP comes from `X-Forwarded-For` set by the Container Apps ingress (forwarded headers configured).

## 6. UI pages

### 6.1 Routes (React Router)
| Route | Auth | Page |
|---|---|---|
| `/login` | public | Sign in |
| `/register` | public | Create account |
| `/` | required | Redirects to `/today` |
| `/today` | required | Today view |
| `/upcoming` | required | Upcoming view |
| `/completed` | required | Completed view |
| `/lists` | required | All lists (main entry point to lists on mobile) |
| `/lists/:listId` | required | One list's tasks |
| `*` | n/a | Not found page with link to `/today` |

- On app start the frontend calls `GET /auth/me`. `401` → protected routes redirect to `/login?returnUrl=<path>`; signed-in users who open `/login` or `/register` are redirected to `/today`. `returnUrl` is accepted only if it is a relative path starting with `/` (no open redirects).
- Any `401` from the API later (session expired) clears cached data and redirects to `/login?returnUrl=...`.

### 6.2 Layout
- **Desktop (≥ 1024 px):** persistent left sidebar with: Today, Upcoming, Completed (with open-task count for Today), a "Lists" section (Inbox first, then other lists, each with open-task count), "+ New list", and at the bottom an account menu (email, "Sign out"). Main content on the right.
- **Tablet (640–1023 px):** same sidebar, collapsible as a drawer behind a menu button.
- **Mobile (< 640 px):** top app bar (page title, actions menu); **bottom navigation** with Today, Upcoming, Completed, Lists. The account menu (email, sign out) is in the top bar.
- The task dialog (create/edit) is a centred modal on desktop and a full-screen sheet on mobile.

### 6.3 Pages
**Login (`/login`)**: email, password, "Sign in" button, link to Register. Inline field validation (required, email format). On `401 Failed`: "Invalid email or password." On `LockedOut`: "Too many attempts. Try again in a few minutes." On `429`: "Too many attempts. Please wait a minute." On success go to `returnUrl` or `/today`.

**Register (`/register`)**: email, password, confirm password (client-side match check only), the password rules shown as helper text. Server errors are shown at the relevant field (`DuplicateUserName`/`DuplicateEmail` → "An account with this email already exists."). On success call login automatically, then go to `/today`.

**Today (`/today`)**: two sections, "Overdue" (only if not empty) and "Today". Each task row: completion checkbox, title, priority indicator (icon + text label, not colour only), list name, and due-date label for overdue tasks. Inline **quick add** at the top (title + Enter) creates the task in the **Inbox** with `dueDate = today`. Empty state: "Nothing due today. Enjoy your day!"

**Upcoming (`/upcoming`)**: tasks grouped by due date with headings ("Tomorrow", then weekday + date within the next 6 days, then full date, formatted in the browser locale). "Add task" button opens the task dialog with list = Inbox and due date = tomorrow. Empty state: "No upcoming tasks."

**Completed (`/completed`)**: completed tasks (checked, struck-through title, list name, "Completed <relative time>"). Unchecking un-completes the task. If `truncated`, show "Showing the 500 most recently completed tasks." Empty state: "No completed tasks yet."

**Lists (`/lists`)**: all lists with open-task counts, "+ New list". Tapping a list opens `/lists/:listId`. Mainly used on mobile; works on desktop too.

**List (`/lists/:listId`)**: list name as the heading; menu with "Rename" and "Delete" (both hidden for the Inbox). Inline quick add (title + Enter, no due date, Medium priority). Open tasks sorted per 5.4, then a collapsed "Completed (n)" section that loads `status=completed` when expanded. Empty state: "No tasks in this list. Add one above." `404` → "This list doesn't exist." with a link to `/today`.

**Task dialog (create/edit)**: fields: title (required), notes (multi-line), due date (native date input, can be cleared), priority (Low/Medium/High, default Medium), list (select, default current list or Inbox). Edit mode also has "Delete" (with confirmation). Save is disabled while submitting. Server `400` errors are shown at the field. Opened by clicking a task row or "Add task"; closes with Esc or Cancel, and returns focus to the element that opened it.

**New / rename list dialog**: name field (required, max 100). `409` shown at the field ("A list with this name already exists."). After creation, navigate to the new list.

**Delete confirmations**: task: "Delete this task?"; list: "Delete list '<name>' and its <n> tasks? This can't be undone."

### 6.4 Interactions
- **Complete / uncomplete** is optimistic: the row updates immediately; in Today/Upcoming/list (open) views the task leaves the view and a toast "Task completed. Undo" is shown for 5 seconds (Undo calls `uncomplete`). On failure the change is rolled back and an error toast is shown.
- Other mutations (create, edit, delete, rename) wait for the server response, then invalidate the affected TanStack Query caches (the views, the list, the list counts).
- Data refetches on window focus. If the local date has changed since the last fetch (e.g. app left open over midnight), Today and Upcoming refetch.

### 6.5 States
| State | Behaviour |
|---|---|
| Loading | Skeleton rows for task lists; spinner on buttons while submitting. No layout jump. |
| Empty | Friendly message per view (above), plus the add action where adding is possible. |
| Error (network/5xx) | Inline message "Couldn't load tasks." with a "Retry" button; mutations show an error toast. |
| Validation (400/409) | Messages next to the relevant field, announced to screen readers. |
| Offline | A persistent banner "You're offline. Showing saved data; changes are disabled." All mutating controls (checkboxes, quick add, Add task, edit, delete, rename, new list) are disabled with a tooltip/description explaining why. Pages not previously loaded show "This page isn't available offline." Sign-in/register show "You need a connection to sign in." |
| Update available | Toast "A new version is available." with a "Reload" button (service worker in prompt mode). |

## 7. Non-functional requirements

### 7.1 Authentication, cookies and origins
- **Same-origin deployment (recommended):** the browser talks **only to the frontend container**. Its web server (e.g. nginx) serves the SPA and **reverse-proxies `/api/*` to the API container** over Container Apps internal networking. The API container uses **internal-only ingress** (not reachable from the internet). The `/health` endpoint is probed by the platform directly.
  - Why: the auth cookie is first-party, so it works even where third-party cookies are blocked (Safari, and increasingly Chrome); `SameSite=Strict` is possible; **no CORS** configuration is needed; the API's attack surface is smaller.
  - The frontend uses a configurable API base URL (`VITE_API_BASE_URL`, default `/api/v1`), never hard-coded. Local development uses the Vite dev-server proxy for `/api` to the local API.
  - Alternative (not recommended): public API with CORS (`AllowCredentials`, explicit frontend origin) and `SameSite=None` cookies, which third-party-cookie blocking can break. See Open questions.
- **Auth cookie:** Identity application cookie, name `MyTodoApp.Auth`, `HttpOnly`, `Secure` (always), `SameSite=Strict`, `Path=/`, no `Domain`. Persistent, **14-day sliding expiration**. API requests that are not authenticated get `401` (no redirect to a login page); forbidden gets `403`.
- **CSRF:** no antiforgery tokens in v1. Protection relies on `SameSite=Strict` + same origin + no CORS, and endpoints with bodies accepting only `application/json` (Minimal APIs reject other content types with `415`).

### 7.2 Security
- Passwords hashed by Identity (PBKDF2 defaults). Lockout and rate limits as in 5.6.
- Ownership checks in every query (filter by current user id); `404` for other users' resources.
- No secrets in code or config; Azure SQL is accessed with managed identity.
- Frontend web server sets security headers: `Content-Security-Policy` (`default-src 'self'`; no inline scripts; `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`. HTTPS only (Container Apps ingress, HTTP redirected or disabled).
- Task notes are rendered as plain text (React escaping), never as HTML.
- On sign out (and on `401`), the client clears the TanStack Query cache and the service worker's API cache, so the next user on a shared device sees nothing.
- Known v1 limitation: registration reveals whether an email is already registered (Identity `DuplicateUserName`). Accepted for v1 because there is no email confirmation.

### 7.3 Accessibility
- Target **WCAG 2.2 level AA**.
- Semantic HTML (landmarks, headings, lists, real `<button>`/`<input type="checkbox">`), every input has a visible label, errors linked with `aria-describedby`.
- Fully keyboard-operable; visible focus indicator; dialogs trap focus, close on Esc and return focus.
- Toasts and validation errors announced via `aria-live`.
- Colour contrast ≥ 4.5:1 for text; priority and overdue state are never conveyed by colour alone (icon + text).
- Touch targets at least 44×44 px on mobile (exceeds WCAG 2.2 target size minimum of 24×24).
- Respects `prefers-reduced-motion`. UI language: English only.

### 7.4 Performance
- Initial JS bundle ≤ **200 KB gzipped**; route-level code splitting where useful.
- LCP ≤ 2.5 s on a mid-range phone over 4G with a warm backend; repeat visits load the app shell from the service worker cache.
- API p95 latency ≤ 300 ms for all endpoints at v1 data sizes (excluding cold starts).
- Cold starts after idle (container scale-to-zero, SQL auto-pause, up to ~1 minute for SQL resume) are accepted (ADR-001). The UI shows its loading state and retries once on a timeout/`503`.
- Queries project directly to DTOs with `AsNoTracking()` and use the indexes in 3.3.

### 7.5 PWA
- `vite-plugin-pwa` (Workbox), **`registerType: 'prompt'`** (user confirms updates, see 6.5).
- Web app manifest: `name: "MyTodoApp"`, `short_name: "Todo"`, `start_url: "/today"`, `scope: "/"`, `display: "standalone"`, `theme_color` and `background_color` from the app's palette, icons 192×192 and 512×512 PNG, a 512×512 **maskable** icon, and an `apple-touch-icon` (180×180).
- **App shell:** precache all built assets; navigation fallback to `index.html` (excluding `/api/*` and `/health`).
- **Read-only offline data:** Workbox runtime caching for `GET /api/v1/*` (including `/auth/me`) with **NetworkFirst** (network timeout 10 s), only status `200` responses cached, max 100 entries, max age 7 days. Non-GET requests are never cached or queued (no background sync).
- Offline detection: `navigator.onLine` + `online`/`offline` events, and a failed request with a network error also switches the UI to offline mode until the next successful request.
- Installable on Chrome/Edge (desktop + Android, install prompt) and iOS/iPadOS Safari ("Add to Home Screen").

### 7.6 Browser support
Latest two major versions of Chrome, Edge, Firefox and Safari (macOS and iOS/iPadOS 17+). No Internet Explorer or legacy Edge.

### 7.7 Logging and monitoring
- API: structured logging with `ILogger` (message templates) to stdout, collected by Container Apps / Log Analytics. Unexpected exceptions are logged with a trace id; the same trace id is returned in the ProblemDetails `traceId` extension.
- **Never log** passwords, cookies, email addresses or task/list content. Log ids instead.
- `/health` endpoint as in 4.8 for liveness/readiness probes.

## 8. Out of scope (v1)
- Search; dark mode / themes; localisation (English only).
- Sharing lists or tasks, collaboration, multiple users per list.
- Reminders, notifications (push or email), recurring tasks, subtasks, attachments, tags/labels, task due **times**.
- Manual drag-and-drop ordering of tasks or lists; custom sort options.
- Email confirmation, password reset / forgot password, change password, change email, two-factor authentication, external logins (Google, Microsoft...), "remember me" toggle.
- Account deletion and data export.
- Offline editing, background sync, conflict resolution.
- Pagination / infinite scroll (caps in 3.4 and 4.1 instead).
- Bulk actions (complete/delete many), archiving lists, undo for deletes.
- Public API for third parties, bearer-token auth, native mobile apps.
- Admin UI, analytics, usage tracking.

## 9. Open questions

1. **Same-origin proxy vs CORS:** OK to have the frontend container reverse-proxy `/api` to an internal-only API container (7.1)? The alternative is a public API with CORS + `SameSite=None` cookies, which is more fragile with third-party-cookie blocking.
2. **Open registration:** anyone on the internet can create an account. Is that intended, or should v1 be restricted (e.g. invite-only or an allow-list of emails)?
3. **Account deletion:** excluded from v1 (section 8). Since users are in the EU (GDPR right to erasure), do you want a simple "Delete my account" in v1?
4. **Limits:** are 100 lists per user and 500 tasks per view response (no pagination) acceptable for v1?
5. **Upcoming horizon:** confirm "no horizon" (all future-dated open tasks) rather than the next 7 days.

**Decisions to record as ADRs in 4.2**
- Same-origin deployment: frontend reverse-proxies `/api` to an internal-only API; Identity cookie auth (`SameSite=Strict`, no CORS, no antiforgery tokens); only register/login of `MapIdentityApi` exposed, plus custom logout/me.
- Every task belongs to a list; default Inbox created atomically at registration, cannot be renamed/deleted.
- Due dates are `DateOnly`; "today" computed per request from the browser's IANA time zone (`timeZone` query parameter); Today includes overdue; Upcoming has no horizon.
- Denormalised `UserId` on tasks (no cascade) for simple ownership filtering.
- Guid v7 ids; enums serialised as camelCase strings.
- No pagination in v1: collection wrapper objects + caps.
- Read-only offline via Workbox NetworkFirst runtime cache of `GET /api/v1/*`; caches cleared on sign-out.
- `/health` probes don't touch the database (keeps Azure SQL serverless able to auto-pause).
