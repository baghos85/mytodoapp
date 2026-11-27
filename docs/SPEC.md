# MyTodoApp: Specification

> **Status:** v1, written by the architect agent (setup step 4.1); owner answers to the open questions applied 2026-11-27. Architecture (section 10) added in step 4.2. **Approved by the owner (step 4.3, 2026-11-27)**; second-round answers applied (section 9).
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
| A6 | As a user, I can permanently delete my account from the Account page, confirming with my current password. All my lists and tasks are deleted, I'm signed out and taken to the login page. |
| A7 | As a visitor or user, I can read a privacy notice explaining what data is stored, why, where, for how long, and how to delete my account. |

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
- **Every task belongs to a list.** Each user gets an **Inbox** list (`IsDefault = true`, `Name = "Inbox"`) created **atomically with the user at registration** (same transaction; e.g. the Infrastructure `DbContext` adds the Inbox when a new user is added, since `MapIdentityApi`'s register endpoint can't be extended directly. Mechanism: see 10.4). Why: one simple invariant (no "list-less" tasks, no nullable `ListId`), every task is visible in exactly one list view, and quick-add from Today has an obvious home.
- Deleting a list deletes all its tasks (database cascade). The Inbox cannot be deleted, so the user always has at least one list.
- Limits (to keep v1 free of pagination): **max 100 lists per user**. Task count is not capped, but collection endpoints return at most **500 tasks** (see 4.1).
- No soft delete, no audit history, no optimistic concurrency in v1 (last write wins).
- **Account deletion** (endpoint 21) removes the user's tasks, then lists, then the Identity user, in **one transaction**. Tasks are deleted explicitly because `TodoTask.UserId` has no cascade. Nothing is kept in the live database; backups are deleted automatically within about 14 days (section 7.8).

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
| 21 | DELETE | `/api/v1/auth/me` | required | 204 | Delete my account and all my data, sign out |
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
Endpoints 1–2 are the built-in ASP.NET Core Identity API endpoints (`app.MapGroup("/api/v1/auth").MapIdentityApi<User>()`); their request/response shapes are defined by the framework and summarised here. `auth` is a deliberate exception to the plural-noun route rule. Endpoints 3, 4 and 21 are ours.

The other endpoints that `MapIdentityApi` maps (`/refresh`, `/confirmEmail`, `/resendConfirmationEmail`, `/forgotPassword`, `/resetPassword`, `/manage/info`, `/manage/2fa`) are **not part of v1 and must return `404`** (e.g. via an allow-list endpoint filter on the group). Bearer-token login (`useCookies` absent/false) is not supported in v1: the API authenticates with the Identity application cookie only. The API code must still be auth-scheme agnostic (see 7.1).

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
| Errors | `400` ProblemDetails with `detail: "Only cookie login is supported."` when `useCookies=true` is absent or not `true` (rejected by the auth endpoint filter before Identity runs; bearer login is not supported in v1). `401` ProblemDetails with `detail` `"Failed"` (wrong email/password) or `"LockedOut"`. `429`. The UI shows a generic "Invalid email or password." for `Failed`. |

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

**21. DELETE `/api/v1/auth/me`** (delete my account; rate-limited with the same policy as register/login)
| | |
|---|---|
| Request | `{ "password": string }`: the current password, required. Bound explicitly with `[FromBody]` (Minimal APIs don't infer a body for DELETE). |
| Behaviour | Verifies the password (`UserManager.CheckPasswordAsync`). Then, in one transaction, permanently deletes all the user's tasks, all their lists and the Identity user. Then signs out (cookie expired). Logs an information event with the user id only (no email). |
| Success | `204 No Content`. |
| Errors | `400` ValidationProblemDetails: `errors.password` = `"Password is required."` or `"Incorrect password."` (nothing is deleted). `401` not signed in. `429`. |

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
- **Registration is open** to anyone (no invite or allow-list). Abuse is limited by the rate limit and lockout below.
- Rate limit (built-in ASP.NET Core rate limiter, no extra package): `register`, `login` and `DELETE /auth/me` share a fixed window of **10 requests per minute per client IP** → `429`. Client IP comes from `X-Forwarded-For` set by the Container Apps ingress (forwarded headers configured).

## 6. UI pages

### 6.1 Routes (React Router)
| Route | Auth | Page |
|---|---|---|
| `/login` | public | Sign in |
| `/register` | public | Create account |
| `/privacy` | public (works signed in or out) | Privacy notice |
| `/account` | required | Account settings: email, sign out, delete account |
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
- **Desktop (≥ 1024 px):** persistent left sidebar with: Today, Upcoming, Completed (with open-task count for Today), a "Lists" section (Inbox first, then other lists, each with open-task count), "+ New list", and at the bottom an account menu (email, "Account", "Sign out") and a small footer link "Privacy". Main content on the right.
- **Tablet (640–1023 px):** same sidebar, collapsible as a drawer behind a menu button.
- **Mobile (< 640 px):** top app bar (page title, actions menu); **bottom navigation** with Today, Upcoming, Completed, Lists. The account menu (email, "Account", "Sign out") is in the top bar. The Privacy link is on the Account page.
- The task dialog (create/edit) is a centred modal on desktop and a full-screen sheet on mobile.

### 6.3 Pages
**Login (`/login`)**: email, password, "Sign in" button, link to Register, footer link "Privacy" (`/privacy`). Inline field validation (required, email format). On `401 Failed`: "Invalid email or password." On `LockedOut`: "Too many attempts. Try again in a few minutes." On `429`: "Too many attempts. Please wait a minute." On success go to `returnUrl` or `/today`.

**Register (`/register`)**: email, password, confirm password (client-side match check only), the password rules shown as helper text. Server errors are shown at the relevant field (`DuplicateUserName`/`DuplicateEmail` → "An account with this email already exists."). On success call login automatically, then go to `/today`. Below the form: "By creating an account you agree that we store your data as described in the Privacy notice." with a link to `/privacy`.

**Account (`/account`)**: shows the signed-in email, a "Sign out" button, a link to the Privacy notice, and a "Danger zone" with a **"Delete my account"** button. That button opens a confirmation dialog: "This permanently deletes your account, all your lists and all your tasks. This can't be undone." plus a required **password** field and a destructive "Delete my account" button (disabled until a password is entered and while submitting). `400 Incorrect password` → error at the password field. On `204`: clear the TanStack Query cache and the service worker API cache, then go to `/login` with a status message "Your account has been deleted." Disabled when offline.

**Privacy (`/privacy`)**: static page, reachable signed in or out, precached for offline. Plain-language content that must cover:
- **What is stored:** email address, password hash (never the password itself), and the lists and tasks you create (names, titles, notes, due dates, priorities, completion state, timestamps). A sign-in cookie is used only to keep you signed in (strictly necessary, no tracking or analytics cookies).
- **Why:** only to provide the app (your account and your tasks). No sharing, selling, advertising or analytics.
- **Where:** Microsoft Azure, EU region **France Central**.
- **Retention:** until you delete your account. After deletion, the data is removed from the live database immediately, and backups are deleted automatically within about **14 days**.
- **Logs:** application logs contain technical data (ids, errors, request metadata) and **no email addresses or task/list content**. Logs are kept for **30 days**.
- **How to delete your account:** Account page → "Delete my account" → confirm with your password. Deletion is immediate and permanent.
- Data export is not available yet.

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
- **Same-origin deployment (owner-approved):** the browser talks **only to the frontend container**. Its **nginx** serves the SPA and **reverse-proxies `/api/*` to the API container** over Container Apps internal networking. The API container uses **internal-only ingress** (not reachable from the internet). The `/health` endpoint is probed by the platform directly.
  - Why: the auth cookie is first-party, so it works even where third-party cookies are blocked (Safari, and increasingly Chrome); `SameSite=Strict` is possible; **no CORS** configuration is needed; the API's attack surface is smaller.
  - The frontend uses a configurable API base URL (`VITE_API_BASE_URL`, default `/api/v1`), never hard-coded. Local development uses the Vite dev-server proxy for `/api` to the local API.
  - The API has **no CORS** configuration.
- **Auth cookie:** Identity application cookie, name `MyTodoApp.Auth`, `HttpOnly`, `Secure` (always), `SameSite=Strict`, `Path=/`, no `Domain`. Persistent, **14-day sliding expiration**. API requests that are not authenticated get `401` (no redirect to a login page); forbidden gets `403`.
- **Auth-scheme agnostic API:** v1 uses cookies only, but bearer tokens (Identity bearer tokens or JWT via OIDC) may be enabled later for a mobile client alongside cookies. So:
  - Endpoints declare auth only with `RequireAuthorization()` / `[Authorize]` (or the group's default policy), never with a scheme-specific check.
  - Handlers and Application code get the user **only through `ICurrentUser`** (implemented in Api/Infrastructure from `HttpContext.User` claims).
  - No code reads the auth cookie or the `Cookie` header directly, or assumes the request was cookie-authenticated. The only cookie-specific code is the Identity/cookie configuration in DI composition and the sign-in/sign-out calls in the auth endpoints.
- **CSRF:** no antiforgery tokens in v1. Protection relies on `SameSite=Strict` + same origin + no CORS, and endpoints with bodies accepting only `application/json` (Minimal APIs reject other content types with `415`).

### 7.2 Security
- Passwords hashed by Identity (PBKDF2 defaults). Lockout and rate limits as in 5.6.
- Ownership checks in every query (filter by current user id); `404` for other users' resources.
- No secrets in code or config; Azure SQL is accessed with managed identity.
- Frontend web server sets security headers: `Content-Security-Policy` (`default-src 'self'`; no inline scripts; `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`. HTTPS only (Container Apps ingress, HTTP redirected or disabled).
- Task notes are rendered as plain text (React escaping), never as HTML.
- On sign out, account deletion and `401`, the client clears the TanStack Query cache and the service worker's API cache, so the next user on a shared device sees nothing.
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

### 7.8 Privacy (GDPR)
- Data is stored only in Azure, EU region France Central (Azure SQL, Log Analytics).
- Data minimisation: only email, password hash (plus Identity's security fields) and the user's own lists and tasks. No analytics, tracking or third-party scripts.
- Right to erasure: self-service account deletion (A6, endpoint 21), effective immediately in the live database. Backups are deleted automatically within **about 14 days**: point-in-time restore (PITR) retention is **7 days**, and Azure keeps the backup files needed for that window for up to a week longer (Azure SQL automated backups, "Backup storage consumption"). The technical setting stays **7-day PITR** (fixed by the free offer, 10.1); the privacy notice (6.3) states "within about 14 days". If PITR retention ever changes, update the privacy notice in the same PR (ADR-014).
- Right to be informed: the public `/privacy` page (6.3).
- Logs contain no email addresses or task/list content (7.7) and are kept for 30 days (Log Analytics retention, 10.11), as stated in the privacy notice.

## 8. Out of scope (v1)
- Search; dark mode / themes; localisation (English only).
- Sharing lists or tasks, collaboration, multiple users per list.
- Reminders, notifications (push or email), recurring tasks, subtasks, attachments, tags/labels, task due **times**.
- Manual drag-and-drop ordering of tasks or lists; custom sort options.
- Email confirmation, password reset / forgot password, change password, change email, two-factor authentication, external logins (Google, Microsoft...), "remember me" toggle.
- Data export (GDPR data portability): planned as a future item.
- Offline editing, background sync, conflict resolution.
- Pagination / infinite scroll (caps in 3.4 and 4.1 instead).
- Bulk actions (complete/delete many), archiving lists, undo for deletes.
- Public API for third parties, bearer-token auth (the API stays scheme-agnostic so it can be added later, see 7.1), native mobile apps.
- Admin UI, analytics, usage tracking.

## 9. Open questions

The owner answered the first round on 2026-11-27 (same origin: yes; open registration: yes; account deletion + privacy page: in v1, data export out; limits: kept; Upcoming: no horizon).

**Raised in step 4.2, answered by the owner in step 4.3 (2026-11-27)**
1. **ADR-017 to ADR-025:** accepted as written (now **Accepted** in `docs/DECISIONS.md`).
2. **Login without `useCookies=true`:** returns **`400`** ProblemDetails `detail: "Only cookie login is supported."` (not a 500), via the auth endpoint filter. Applied to endpoint 2 (4.4) and 10.2.
3. **Log retention in the privacy notice:** the Privacy page states that application logs are kept **30 days** (6.3, 7.8).
4. **Azure SQL free offer:** use it. When the monthly free limit is used up, the database **auto-pauses until the next month**; never bill over the limit. Applied to ADR-017 and 10.1 (including the consequence: the app is unavailable until the month resets while `/health` stays green).
5. **One-time Entra steps** (ADR-019): agreed. They stay an **owner action in Phase 5**, before the first deployment (10.6).

**Decisions recorded as ADRs in 4.2** (ADR-009 to ADR-016)
- Same-origin deployment: nginx in the frontend container reverse-proxies `/api` to an API with internal-only ingress; no CORS; Vite dev-server proxy locally.
- Cookie-only auth in v1 (Identity application cookie, HttpOnly, Secure, `SameSite=Strict`, no antiforgery tokens); only register/login of `MapIdentityApi` exposed, plus custom logout, me and delete-me.
- Auth-scheme agnostic API: `RequireAuthorization()`/`[Authorize]` only, user via `ICurrentUser` only, no direct cookie access, so bearer tokens (Identity bearer or JWT via OIDC) can be added later for a mobile client.
- Open registration, protected by rate limiting (10/min/IP) and Identity lockout.
- GDPR: self-service account deletion with password confirmation (hard delete in one transaction), public privacy notice, 7-day SQL point-in-time restore (privacy notice: backups deleted within about 14 days, 7.8); data export deferred.
- Every task belongs to a list; default Inbox created atomically at registration, cannot be renamed/deleted.
- Due dates are `DateOnly`; "today" computed per request from the browser's IANA time zone (`timeZone` query parameter); Today includes overdue; Upcoming has no horizon.
- Denormalised `UserId` on tasks (no cascade) for simple ownership filtering.
- Guid v7 ids; enums serialised as camelCase strings.
- No pagination in v1: `{ items, truncated }` wrapper, max 100 lists per user, max 500 tasks per response.
- Read-only offline via Workbox NetworkFirst runtime cache of `GET /api/v1/*`; caches cleared on sign-out, account deletion and `401`.
- `/health` probes don't touch the database (keeps Azure SQL serverless able to auto-pause).

**Open questions: none.**

## 10. Architecture

How the system is built and deployed. Decisions behind it: ADR-009 to ADR-025 in `docs/DECISIONS.md` (all **Accepted**; ADR-017 to ADR-025 accepted by the owner in step 4.3).

### 10.1 Runtime overview

```
 Browser (SPA + service worker)
    |  HTTPS, one origin: https://ca-mytodoapp-web.<env-default-domain>
    v
+-- cae-mytodoapp (Container Apps environment, Consumption, no VNet) ----------------------+
|                                                                                          |
|  ca-mytodoapp-web     external ingress, HTTPS only, target port 8080                     |
|  nginx-unprivileged:  /            -> static SPA (index.html fallback)                   |
|                       /api/*       -> reverse proxy -----------------+                   |
|                       /healthz     -> 200 (probe)                    |                   |
|                                                                      v                   |
|  ca-mytodoapp-api     internal ingress only, target port 8080   (https://ca-mytodoapp-   |
|  ASP.NET Core .NET 10 (Minimal APIs, Identity cookie)            api.internal.<domain>)  |
|                                                                                          |
|  caj-mytodoapp-migrate  Container Apps Job, manual trigger: EF Core migration bundle     |
+----------------|---------------------------------------------|---------------------------+
                 | TDS 1433, Entra token (user-assigned MI)    | stdout/stderr
                 v                                             v
   sql-mytodoapp-<sfx> / sqldb-mytodoapp               log-mytodoapp (Log Analytics)
   (serverless, Entra-only auth)
   acrmytodoapp<sfx> (images; pulled with AcrPull by each app's identity)
```

All resources live in **`rg-mytodoapp`** (France Central). `<sfx>` = `take(uniqueString(resourceGroup().id), 6)`, used only where the name must be globally unique.

| Resource | Name | Settings |
|---|---|---|
| Log Analytics workspace | `log-mytodoapp` | PerGB2018, **30-day** retention |
| Container Apps environment | `cae-mytodoapp` | Consumption only, no VNet, app logs → `log-mytodoapp` |
| Container registry | `acrmytodoapp<sfx>` | Basic SKU, admin user **disabled**, RBAC (non-ABAC) permissions mode |
| Web app | `ca-mytodoapp-web` | External ingress, `allowInsecure: false`, single revision mode |
| API app | `ca-mytodoapp-api` | **Internal ingress only**, single revision mode |
| Migration job | `caj-mytodoapp-migrate` | Trigger `Manual`, replica timeout 600 s, retry limit 1 |
| SQL logical server | `sql-mytodoapp-<sfx>` | **Entra-only auth**, min TLS 1.2, public network access with the "Allow Azure services" rule only (ADR-019) |
| SQL database | `sqldb-mytodoapp` | Serverless `GP_S_Gen5`, capacity (max vCores) 2, as in Microsoft's free-offer template; max size, min capacity and auto-pause delay are **not set** in Bicep (setting them fails on the free offer): max size is the free-offer default of 32 GB and auto-pause is fixed by the free offer at 15 min; PITR **7 days** (fixed by the free offer), backup storage redundancy **Local** (keeps backups in France Central, matches the privacy notice). **Azure SQL Database free offer** (`useFreeLimit: true`, `freeLimitExhaustionBehavior: 'AutoPause'`, never `BillOverUsage`), see below |
| Managed identities (user-assigned) | `id-mytodoapp-web`, `id-mytodoapp-api`, `id-mytodoapp-migrate` | Each: AcrPull on the registry. SQL rights: see 10.6 |

Images in ACR: `mytodoapp-web`, `mytodoapp-api`, `mytodoapp-migrate`, tagged with the full commit SHA (never `latest`).

**Azure SQL free offer (owner decision, ADR-017):** the database uses the free offer (a monthly allowance of free vCore-seconds and storage; the number of free databases per subscription is limited). When the monthly allowance is used up, the database **auto-pauses until the start of the next month** (UTC); usage over the limit is **never billed**. Consequences:
- Until the month resets, every API call that needs the database fails (generic `500`/connection errors), so the app is effectively **unavailable**; sign-in and all list/task pages fail.
- `/health` (API) and `/healthz` (nginx) **stay green**, because they don't touch the database (4.8, ADR-016). Probes, the deploy smoke test (`/api/v1/auth/me` → `401` needs no DB) and Container Apps do not detect it; it shows up only as API errors in `log-mytodoapp`.
- Migration job runs also fail while the database is paused for the month, so deployments with a migration step fail until the reset.
- Each wake-up from auto-pause consumes allowance for at least the 15-minute auto-pause delay (fixed by the free offer, not configurable), so frequent short visits use the allowance faster than steady use.
- If the subscription can't get the free offer, the devops agent stops and asks the owner (no silent fallback to a billed tier).

### 10.2 Request and auth flow
1. Browser loads the SPA from `ca-mytodoapp-web`. SPA calls `GET /api/v1/auth/me` (relative URL, same origin).
2. nginx proxies `/api/*` to the API's internal FQDN. The API answers `401` → SPA shows `/login`.
3. `POST /api/v1/auth/login?useCookies=true` → API sets `MyTodoApp.Auth` (`HttpOnly; Secure; SameSite=Strict; Path=/`). nginx passes `Set-Cookie` through unchanged, so the cookie belongs to the **frontend origin**.
4. Later `/api` calls carry the cookie automatically; nginx forwards it; the API authenticates via the Identity cookie handler.

nginx `/api/` location (in `src/frontend/nginx/default.conf.template`, rendered by the nginx image's built-in envsubst at start-up):

```nginx
location /api/ {
    proxy_pass ${API_UPSTREAM};                    # e.g. https://ca-mytodoapp-api.internal.<env-default-domain> (no path: URI passed unchanged)
    proxy_ssl_server_name on;
    proxy_set_header Host $proxy_host;             # REQUIRED: Container Apps routes by Host, so it must be the API's FQDN
    proxy_set_header X-Forwarded-Host $host;       # original public host
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $fwd_proto; # map: $http_x_forwarded_proto from the external ingress, else $scheme
    proxy_connect_timeout 10s;
    proxy_read_timeout 120s;                       # covers SQL serverless resume (~1 min)
    client_max_body_size 64k;
}
```

- **Do not forward the original `Host` as `Host`**: the environment's internal ingress would not find the API app. The original host travels in `X-Forwarded-Host`.
- How nginx reaches the API: through the environment's internal ingress at `https://ca-mytodoapp-api.internal.<env-default-domain>` (Bicep: `apiApp.properties.configuration.ingress.fqdn`), passed to the web container as `API_UPSTREAM`. Locally (compose) `API_UPSTREAM=http://api:8080`.
- **API forwarded headers** (`UseForwardedHeaders()` first in the pipeline): `ForwardedHeaders = XForwardedFor | XForwardedProto`; clear `KnownIPNetworks` and `KnownProxies` (`KnownNetworks` is obsolete in .NET 10; the API is only reachable from inside the environment); `ForwardLimit` from config (`ForwardedHeaders:ForwardLimit`, default **2**: external ingress → nginx → internal ingress). The devops issue must verify the hop count on Azure (log `RemoteIpAddress` once) because the rate limiter (5.6) keys on it. Never set `ForwardLimit = null` (a client could spoof `X-Forwarded-For`).
- TLS ends at the Container Apps ingress. The API doesn't call `UseHttpsRedirection`/`UseHsts` (nginx sends HSTS). The cookie uses `CookieSecurePolicy.Always`.
- Unauthenticated → `401`, forbidden → `403`: set `Events.OnRedirectToLogin`/`OnRedirectToAccessDenied` to write the status code (don't rely only on .NET 10's API-endpoint detection).
- Identity registration: `AddIdentityCore<User>().AddEntityFrameworkStores<AppDbContext>().AddSignInManager().AddApiEndpoints()` + `AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies()`. **Not** `AddIdentityApiEndpoints` (it also registers the bearer scheme).
- `/api/v1/auth` group: an endpoint filter allows only `register`, `login`, `logout`, `me` (GET/DELETE); everything else from `MapIdentityApi` returns `404` (4.4). The same filter rejects login without `useCookies=true` with `400` ProblemDetails `detail: "Only cookie login is supported."` (endpoint 2), so the unregistered bearer scheme is never reached.
- Rate limiter: built-in `AddRateLimiter`, policy `"auth"` (fixed window, partition = `RemoteIpAddress`), `PermitLimit`/`Window` from config `RateLimiting:Auth` (defaults 10 / 1 min) so tests can raise them. `OnRejected` sets `Retry-After` and writes ProblemDetails `429`.

### 10.3 Backend solution structure

Root files: `MyTodoApp.slnx` (all projects), `global.json` (pins .NET 10 SDK), `Directory.Build.props` (nullable, implicit usings, `TreatWarningsAsErrors`, `InvariantGlobalization=false`), `Directory.Packages.props` (central package versions), `.editorconfig`, `.config/dotnet-tools.json` (`dotnet-ef`).
- The real settings live in `src/backend/Directory.Build.props` and `src/backend/Directory.Packages.props` (runtime package versions); the root files only `<Import>` them (the root `Directory.Packages.props` adds the test package versions). Reason: the API image is built with context `src/backend` (10.9), which can't see root files. Don't move the settings back to the root. A root `nuget.config` restricts restore to nuget.org (central package management fails with NU1507 when several sources are configured).

| Project | References | Contents |
|---|---|---|
| `MyTodoApp.Domain` | none (no packages) | Entities `TaskList`, `TodoTask` (`UserId` is a plain `Guid`, no navigation to the Identity user), enum `TaskPriority`, length constants (`TaskList.NameMaxLength = 100`...), behaviour (`Rename`, `Complete(now)`, `Uncomplete(now)`, `MoveTo(listId)`, `TaskList.CreateInbox(userId, now)`, Inbox guards). |
| `MyTodoApp.Application` | Domain; package `Microsoft.EntityFrameworkCore` (no provider) | Commands/queries, handlers, DTOs + `ToDto()`, interfaces. |
| `MyTodoApp.Infrastructure` | Application | `AppDbContext`, configurations, migrations, Identity `User`, `IdentityService`, Data Protection key store. |
| `MyTodoApp.Api` | Application, Infrastructure (composition root only) | `Program.cs`, endpoints, request records, auth, rate limiting, exception handler, OpenAPI. |
| `MyTodoApp.Domain.UnitTests` | Domain | Entity behaviour. |
| `MyTodoApp.Application.UnitTests` | Application, Infrastructure | Handlers against `AppDbContext` on SQLite in-memory (10.12). |
| `MyTodoApp.Api.IntegrationTests` | Api | `WebApplicationFactory` + SQL Server in Testcontainers. |

`Common/` folders:
| Project | `Common/` contains |
|---|---|
| Domain | `DomainException` base, `NotFoundException`, `ConflictException`, `ForbiddenException`, `DomainValidationException` (carries `Field` + message, for `errors.<field>`). |
| Application | `ICommandHandler<,>`, `IQueryHandler<,>`, `IAppDbContext`, `ICurrentUser`, `IIdentityService`, `Time/TimeProviderExtensions.GetToday(TimeZoneInfo)`, `Time/UserTimeZone.TryResolve(string?, out TimeZoneInfo)`, `DependencyInjection.AddApplication()`. |
| Infrastructure | `DependencyInjection.AddInfrastructure(IConfiguration)`, `Persistence/` (`AppDbContext`, `UtcDateTimeConverter`, `DesignTimeDbContextFactory`, `Migrations/`). Identity code in `Identity/`. |
| Api | `ExceptionHandler` (`IExceptionHandler`), `HttpCurrentUser`, `JsonSetup`, `AuthSetup`, `RateLimitingSetup`, `ForwardedHeadersSetup`. |

Feature and action folder names (use exactly these):
| Feature | Actions (endpoint #) |
|---|---|
| `Accounts` (Api group `/api/v1/auth`) | `GetCurrentUser` (4), `DeleteAccount` (21), `Logout` (3, Api only, no handler). Register/login come from `MapIdentityApi`. |
| `TaskLists` | `GetTaskLists` (5), `GetTaskList` (6), `CreateTaskList` (7), `RenameTaskList` (8), `DeleteTaskList` (9) |
| `Tasks` | `GetListTasks` (10), `CreateTask` (11), `GetTask` (12), `UpdateTask` (13), `DeleteTask` (14), `CompleteTask` (15), `UncompleteTask` (16), `GetTodayTasks` (17), `GetUpcomingTasks` (18), `GetCompletedTasks` (19) |

`TasksEndpoints.cs` maps two groups: `/api/v1/tasks` and `/api/v1/task-lists/{listId:guid}/tasks`.

**DI composition** (`Program.cs`): `builder.Services.AddApplication().AddInfrastructure(builder.Configuration)` plus Api setup methods; endpoints via `app.MapAccountsEndpoints()`, `MapTaskListsEndpoints()`, `MapTasksEndpoints()`, `app.MapHealthChecks("/health")`.
- `AddApplication()` registers handlers by **reflection scanning** of the Application assembly (plain .NET reflection, no Scrutor): every non-abstract class implementing a closed `ICommandHandler<,>` or `IQueryHandler<,>` is registered **scoped** under that interface. New handlers need no registration edit (fewer merge conflicts between parallel PRs). A unit test asserts every handler resolves; Development uses `ValidateOnBuild`.
- Endpoints inject the handler interface, e.g. `ICommandHandler<CreateTaskCommand, TaskDto>`.
- Two command handler shapes: `ICommandHandler<TCommand, TResult>` (`Task<TResult> HandleAsync(...)`, e.g. create → DTO) and `ICommandHandler<TCommand>` (`Task HandleAsync(...)`, for `204` endpoints: rename, delete, complete...). Never invent a `Unit` result type. Both are picked up by the reflection scan.

**`ICurrentUser`** (`Guid UserId { get; }`) is implemented in Api by `HttpCurrentUser` (scoped) from `ClaimTypes.NameIdentifier`; throws `InvalidOperationException` if absent (it's only used behind `RequireAuthorization()`). No other code reads `HttpContext.User`.

**`IIdentityService`** (Application interface, Infrastructure implementation over `UserManager<User>`): `FindEmailAsync(userId, ct)` (for `GET /auth/me`; `null` → endpoint returns `401`, e.g. account deleted on another device), `CheckPasswordAsync(userId, password, ct)`, `DeleteUserAndDataAsync(userId, ct)` (one transaction, see 10.4). The `DeleteAccount` handler: password check → `DomainValidationException("password", "Incorrect password.")` or delete; the endpoint then calls `SignInManager.SignOutAsync()`.

**Time:** `TimeProvider.System` registered as singleton; code injects `TimeProvider` (no separate `IClock`). Never `DateTime.Now/UtcNow`.

**User time zone (endpoints 17, 18):** handler calls `UserTimeZone.TryResolve(query.TimeZone, out tz)` (`TimeZoneInfo.TryFindSystemTimeZoneById`; missing or unknown → `DomainValidationException("timeZone", "The time zone is missing or unknown.")`), then `today = timeProvider.GetToday(tz)` (formula in 5.1). IANA ids need ICU + tzdata: the runtime image is the regular (non-chiseled) `aspnet` image and `InvariantGlobalization` stays `false`; an integration test resolves `Europe/Paris`.

**JSON:** `ConfigureHttpJsonOptions`: `JsonStringEnumConverter(JsonNamingPolicy.CamelCase)`; camelCase is the default. `DateOnly` → `"YYYY-MM-DD"` natively; `DateTime` with `Kind = Utc` → `...Z` (see the UTC converter in 10.4).

**Errors:** `ExceptionHandler` maps `NotFoundException` → 404, `ConflictException` → 409, `ForbiddenException` → 403, `DomainValidationException` → 400 `ValidationProblemDetails` (`errors[field]`), else 500 with `title: "An unexpected error occurred."` + `traceId`, logged at Error with a message template. Request binding errors (`BadHttpRequestException`: malformed JSON, wrong types, missing body; `ThrowOnBadRequest = true` in every environment) → their own status (400) as ProblemDetails without the framework message and without an Error log. Empty error responses (e.g. the framework's 415 for a non-JSON `Content-Type`) get a ProblemDetails body from status code pages (`StatusCodePagesSetup`); 404 is excluded until the auth issue tightens the deploy smoke test.

### 10.4 Data access
- `AppDbContext : IdentityUserContext<User, Guid>, IAppDbContext, IDataProtectionKeyContext` (Infrastructure). `IdentityUserContext` = users, claims, logins, tokens; no role tables (no roles in v1). Identity tables keep their default names (`AspNetUsers`...); ours: `TaskLists`, `Tasks`, `DataProtectionKeys`.
- `User : IdentityUser<Guid>` lives in `Infrastructure/Identity/` (Domain must not reference Identity); its constructor sets `Id = Guid.CreateVersion7()`.
- `IAppDbContext` exposes `DbSet<TaskList> TaskLists`, `DbSet<TodoTask> Tasks`, `SaveChangesAsync(ct)`. Users are reached only through `IIdentityService`.
- Configurations: `Infrastructure/TaskLists/TaskListConfiguration.cs`, `Infrastructure/Tasks/TodoTaskConfiguration.cs`, applied with `ApplyConfigurationsFromAssembly`. Relationships to `User` are configured there with `HasOne<User>().WithMany().HasForeignKey(x => x.UserId)`.
- Conventions (`ConfigureConventions`): all `DateTime` properties use `UtcDateTimeConverter` (writes UTC, reads with `DateTimeKind.Utc`; otherwise EF returns `Unspecified` and JSON loses the `Z`). `DateOnly` → `date`, `TaskPriority` → `int`. Explicit max lengths per 3.2/3.3. Default database collation (case-insensitive) is relied on for name uniqueness.
- **Inbox at registration:** `AppDbContext.SaveChangesAsync` override: for every `User` entry in state `Added`, add `TaskList.CreateInbox(user.Id, now)` before calling `base.SaveChangesAsync`. `UserManager.CreateAsync` saves once, so user + Inbox are one transaction. `AppDbContext` gets `TimeProvider` by constructor injection; `DesignTimeDbContextFactory` supplies `TimeProvider.System` for `dotnet ef`.
- **Unique-index race:** `SaveChangesAsync` translates `DbUpdateException` with SQL error 2601/2627 into `ConflictException` (handlers pre-check names; this only catches races).
- **Ownership:** explicit `Where(x => x.UserId == currentUser.UserId)` in every query. No global query filters (visible in review, no hidden coupling to `ICurrentUser`).
- **Queries:** `AsNoTracking()`, `Select` straight to DTO (`openTaskCount` and `listName` as subqueries/joins in the projection). Task collections `Take(501)`; `truncated = count > 500`, return the first 500.
- **Resilience:** `UseSqlServer(cs, o => o.EnableRetryOnFailure(maxRetryCount: 6, maxRetryDelay: 30 s))`, `Connect Timeout=60` (serverless resume). Explicit transactions (account deletion) run inside `Database.CreateExecutionStrategy().ExecuteAsync(...)`.

Indexes and delete behaviour:
| Table | Index / FK | Purpose |
|---|---|---|
| TaskLists | unique `(UserId, Name)` | name uniqueness (case-insensitive via collation); list queries by user |
| TaskLists | unique filtered `(UserId) WHERE IsDefault = 1` | at most one Inbox per user |
| TaskLists | FK `UserId` → AspNetUsers, **Cascade** | |
| Tasks | `(UserId, IsCompleted, DueDate)` | Today / Upcoming |
| Tasks | `(UserId, IsCompleted, CompletedAt)` | Completed view |
| Tasks | `(ListId, IsCompleted)` | list view, `openTaskCount` |
| Tasks | FK `ListId` → TaskLists, **Cascade** | deleting a list deletes its tasks |
| Tasks | FK `UserId` → AspNetUsers, **NoAction** | avoids multiple cascade paths |

**Account deletion** (`IdentityService.DeleteUserAndDataAsync`): inside the execution strategy, one transaction: `Tasks.Where(UserId).ExecuteDeleteAsync()`, `TaskLists.Where(UserId).ExecuteDeleteAsync()`, `UserManager.DeleteAsync(user)`, commit.

### 10.5 Database migrations (ADR-018)
| Option | Problem |
|---|---|
| (a) API migrates at start-up | API identity would need DDL rights (not least privilege); start-up blocked by SQL resume; several replicas start at once; failed migration = unhealthy app. |
| (b) `deploy.yml` runs a bundle from the GitHub runner | Deploy identity (ADR-005) has no SQL data-plane access; SQL firewall would have to admit GitHub runner IPs; CI identity gains DDL rights on production data. |
| (c) Idempotent SQL script | Same network/identity problems as (b), plus a separate tool to run it. |
| **(d) Chosen: EF Core migration bundle in a Container Apps Job** | Runs inside Azure with its own identity; see below. |

- Migrations live in `MyTodoApp.Infrastructure/Persistence/Migrations`, created with `dotnet ef migrations add <Name> --project src/backend/MyTodoApp.Infrastructure --startup-project src/backend/MyTodoApp.Api`. Each schema change PR includes its migration.
- Image `mytodoapp-migrate` (`src/backend/Migrate.Dockerfile`), **built from the repository root** (`docker build -f src/backend/Migrate.Dockerfile .`) because it needs `infra/sql/grant-api-user.sql` as well as `src/backend`; it has its own ignore file `src/backend/Migrate.Dockerfile.dockerignore` (per-Dockerfile ignore files need BuildKit, the default in compose and on GitHub runners). SDK stage runs `dotnet ef migrations bundle --self-contained -r linux-x64` (added by the data model issue); a throwaway stage downloads `go-sqlcmd` (pinned version, checksum-verified); runtime stage `runtime-deps:10.0` + `sqlcmd`, non-root. Entrypoint `src/backend/migrate-entrypoint.sh`:
  1. If `API_CLIENT_ID` is set: `sqlcmd` (managed identity login with `SQL_CLIENT_ID`, against `SQL_SERVER` / `SQL_DATABASE`, retried for SQL resume) runs `infra/sql/grant-api-user.sql` with sqlcmd variables `ApiDbUser` (= `API_DB_USER`) and `ApiClientId` (= `API_CLIENT_ID`). The script is idempotent: it creates the `id-mytodoapp-api` DB user with `CREATE USER [...] WITH SID = <SID from the API identity's client id>, TYPE = E`, recreates it if an existing user has a different SID (identity recreated), and adds it to `db_datareader` + `db_datawriter`. If `API_CLIENT_ID` is empty (local compose, no Entra) this step is skipped.
  2. If the image contains `/app/efbundle`: `efbundle --connection "$ConnectionStrings__AppDb"`; otherwise skipped (before the data model issue).
- Job `caj-mytodoapp-migrate` runs as `id-mytodoapp-migrate`. EF Core's migration lock prevents concurrent runs.
- `deploy.yml` starts the job **after** pushing images and **before** switching the API to the new image; a failed migration stops the deployment with the old version still serving.
- **Migrations must be backward compatible** with the previous API version (expand/contract: add columns nullable or with defaults, drop in a later release), because the old revision serves while the job runs.
- Cold start: the bundle's connection uses `Connect Timeout=60` and EF retry; the job retry limit is 1.
- Locally: compose service `migrate` (same image, SQL auth) or `dotnet ef database update`. Integration tests apply migrations with `Database.MigrateAsync()`.

### 10.6 Azure SQL authentication (ADR-019)
- **Entra-only authentication** (`azureADOnlyAuthentication: true`); no SQL logins or passwords anywhere in Azure.
- **Entra admin:** security group **`sg-mytodoapp-sql-admins`** (`principalType: Group`); members: the owner and `id-mytodoapp-migrate`. Group object id: Bicep param `sqlAdminGroupObjectId` from GitHub repo variable `SQL_ADMIN_GROUP_OBJECT_ID` (an identifier, not a secret).
- **Database users** (least privilege):
  | Identity | DB roles | Created by |
  |---|---|---|
  | `id-mytodoapp-api` | `db_datareader`, `db_datawriter` (no DDL) | migration job, `grant-api-user.sql`, every run (idempotent) |
  | `id-mytodoapp-migrate` | server Entra admin (via group) | owner adds it to the group once |
  | `id-mytodoapp-web` | none | |
- The API user is created with **`CREATE USER [id-mytodoapp-api] WITH SID = <sid>, TYPE = E`**, where `<sid>` is the API identity's **client id** (not its object/principal id) converted to `varbinary(16)`. This form does no Microsoft Entra lookup, so the SQL server's identity needs **no "Directory Readers"** role. (`FROM EXTERNAL PROVIDER`, also with `WITH OBJECT_ID`, validates the principal in Entra and needs Directory Readers when a service principal runs it; don't switch back to it.)
- **One-time owner steps** (Entra directory objects, not Azure resources; agreed by the owner in step 4.3, done as an owner action in Phase 5 before the first deployment): create the group, add yourself, set `SQL_ADMIN_GROUP_OBJECT_ID`; after the first deployment creates `id-mytodoapp-migrate`, add it to the group and re-run the failed deployment. Before that, the first deployment's migration step fails (expected once).
- **Group membership delay:** a managed identity's new group membership can take **several hours** to apply, because its tokens are cached (no forced refresh). A re-run right after adding `id-mytodoapp-migrate` to the group may still fail; wait and re-run later (the `deploy.yml` notice says so).
- API connection string (no secret): `Server=tcp:sql-mytodoapp-<sfx>.database.windows.net,1433;Database=sqldb-mytodoapp;Authentication=Active Directory Managed Identity;User Id=<id-mytodoapp-api clientId>;Encrypt=True;Connect Timeout=60`.
- Network: public endpoint with only the "Allow Azure services" firewall rule (Consumption Container Apps have no fixed outbound IP). No client-IP rules in Bicep (public repo). Private endpoint + VNet is a later option (cost).

### 10.7 Configuration and secrets
No secrets in the repo or in Azure config: SQL uses managed identity; Data Protection keys are in the database (ADR-020).

| Container | Setting (env var) | Value / source |
|---|---|---|
| api | `ASPNETCORE_ENVIRONMENT` | `Production` |
| api | `ConnectionStrings__AppDb` | composed in Bicep (10.6), API identity client id |
| api | `AllowedHosts` | API internal FQDN (Bicep) |
| api | `ForwardedHeaders__ForwardLimit` | `2` (verify, 10.2) |
| api | `Logging__Console__FormatterName` | `json` |
| web | `API_UPSTREAM` | `https://` + API ingress FQDN (Bicep) |
| migrate | `ConnectionStrings__AppDb` | as API, but migrate identity client id |
| migrate | `SQL_SERVER`, `SQL_DATABASE` | SQL server FQDN, `sqldb-mytodoapp` (Bicep), for `sqlcmd` |
| migrate | `SQL_CLIENT_ID` | migrate identity client id (Bicep), `sqlcmd` managed identity login |
| migrate | `API_DB_USER`, `API_CLIENT_ID` | `id-mytodoapp-api`, its **client id** (not principal id; used as the user's SID, 10.6) (Bicep) |

- GitHub: secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (ADR-005); variable `SQL_ADMIN_GROUP_OBJECT_ID`.
- Bicep: `infra/core.bicep`, `infra/apps.bicep`, `infra/modules/*.bicep`, parameter files `*.bicepparam`; image tags are deployment parameters.
- Frontend build-time: `VITE_API_BASE_URL` (default `/api/v1`). No runtime config file needed.
- **Data Protection:** `AddDataProtection().SetApplicationName("MyTodoApp").PersistKeysToDbContext<AppDbContext>()`, so cookies survive restarts, scale-to-zero and new revisions.

**Local development**
- `compose.yaml` (repo root): `sql` (`mcr.microsoft.com/mssql/server:2022-latest`, port 1433), `migrate`, `api` (host port 5080), `web` (nginx image, host port 8080, `API_UPSTREAM=http://api:8080`). Local SA password in `.env` (git-ignored; `.env.example` committed with a placeholder). `docker compose up --build` gives the production topology at `http://localhost:8080`.
- Inner loop: `docker compose up sql migrate`, then `dotnet run --project src/backend/MyTodoApp.Api` (`http://localhost:5080`, connection string in `dotnet user-secrets`) and `npm run dev` in `src/frontend` (Vite `:5173`, `server.proxy['/api'] → http://localhost:5080`).
- Secure cookies work on `http://localhost` in Chromium and Firefox (localhost is a secure context); use one of them for local work.
- OpenAPI (`/openapi/v1.json`) is mapped in Development only.

### 10.8 Frontend architecture
```
src/frontend/
  Dockerfile  nginx/default.conf.template  vite.config.ts  index.html  public/ (icons)
  src/
    main.tsx
    app/        App.tsx, router.tsx, providers.tsx (QueryClient), RequireAuth.tsx, layout/ (AppShell, Sidebar, BottomNav, TopBar)
    features/
      auth/     api.ts, hooks.ts (useMe, useLogin, useRegister, useLogout), LoginPage, RegisterPage
      account/  AccountPage, DeleteAccountDialog
      lists/    api.ts, hooks.ts, types.ts, ListsPage, ListPage, ListDialog
      tasks/    api.ts, hooks.ts, types.ts, TaskRow, TaskDialog, QuickAdd
      views/    TodayPage, UpcomingPage, CompletedPage
      privacy/  PrivacyPage
    shared/
      api/      client.ts (apiFetch), errors.ts (ApiError, ProblemDetails), queryKeys.ts
      ui/       Button, Dialog (native <dialog>), Toast, Skeleton, OfflineBanner
      hooks/    useOnlineStatus, useTimeZone
      lib/      dates.ts (todayIn(tz), parseDateOnly, formatting)
      pwa/      useServiceWorkerUpdate.ts, clearClientData.ts
    test/       setup.ts, renderWithProviders.tsx
```
- **Routing:** React Router `createBrowserRouter`, routes per 6.1, pages lazy-loaded. `RequireAuth` uses `useMe()`; `returnUrl` validated (relative, starts with `/`, not `//`).
- **Styling:** CSS Modules + CSS custom properties (built into Vite). No UI library, no CSS-in-JS that injects `<style>` tags (CSP).
- **API client `apiFetch<T>(path, init)`:** base `import.meta.env.VITE_API_BASE_URL ?? '/api/v1'`; `credentials: 'same-origin'`; JSON body + `Content-Type: application/json`; timeout 90 s (`AbortSignal`); `204` → `undefined`; non-2xx → parses `application/problem+json` and throws `ApiError { status, title, detail?, errors?: Record<string, string[]>, traceId? }`; fetch failure → `NetworkError` (switches UI to offline mode, 7.5).
- **Date-only values:** never `new Date('YYYY-MM-DD')` (parses as UTC, off by one day). Use `shared/lib/dates.ts`.
- **TanStack Query:**
  | Key | Data |
  |---|---|
  | `['auth','me']` | current user (`retry: false`; `401` → `null`) |
  | `['lists']`, `['lists', id]` | lists, one list |
  | `['tasks','list', listId, status]` | list view |
  | `['tasks','today', tz, localDate]`, `['tasks','upcoming', tz, localDate]` | smart views (local date in the key → refetch after midnight) |
  | `['tasks','completed']`, `['tasks','detail', id]` | |
  - Invalidation: any task mutation → `['tasks']` + `['lists']` (counts). List create/rename → `['lists']`; list delete → `['lists']` + `['tasks']`.
  - Complete/uncomplete is optimistic (6.4): cancel `['tasks']` queries, remove/update the task in cached views, roll back on error, invalidate on settle.
  - Defaults: `staleTime` 30 s, `refetchOnWindowFocus: true`, queries `networkMode: 'offlineFirst'` (so offline requests still reach the service worker cache), retry once only on `NetworkError`/timeout/`503`, never on 4xx.
  - Global `QueryCache`/`MutationCache` `onError`: `401` (except from `me`/`login`) → `clearClientData()` + navigate to `/login?returnUrl=...`.
- **`clearClientData()`:** `queryClient.clear()` + `caches.delete('api-v1')`. Called on sign-out, account deletion and `401`.
- **PWA (vite-plugin-pwa):** `registerType: 'prompt'`, `injectRegister: false` (register via `virtual:pwa-register/react`, no inline script), manifest per 7.5. Workbox: precache all build output (app shell incl. the Privacy chunk); `navigateFallback: 'index.html'`, deny-list `^/api/`, `^/health`, `^/healthz`; runtime caching for same-origin `GET /api/v1/*`: `NetworkFirst`, `cacheName: 'api-v1'`, `networkTimeoutSeconds: 10`, `maxEntries: 100`, `maxAgeSeconds: 604800`, `cacheableResponse.statuses: [200]`. Non-GET requests are not cached.

### 10.9 Containers
| | API (`src/backend/MyTodoApp.Api/Dockerfile`, context `src/backend`) | Web (`src/frontend/Dockerfile`, context `src/frontend`) |
|---|---|---|
| Build stage | `mcr.microsoft.com/dotnet/sdk:10.0`, `dotnet publish -c Release` | `node:24-alpine`, `npm ci && npm run build` |
| Runtime | `mcr.microsoft.com/dotnet/aspnet:10.0` (regular, has ICU + tzdata) | `nginxinc/nginx-unprivileged:stable-alpine` |
| User | non-root `USER $APP_UID` | non-root (uid 101) |
| Port | 8080 (`ASPNETCORE_HTTP_PORTS=8080`) | 8080 |
| Probes | liveness + readiness `GET /health`; startup probe `GET /health` (period 3 s, failure threshold 20). Probes send **`Host: <API internal FQDN>`** (`probeHost` in `container-app.bicep`), because `AllowedHosts` is the internal FQDN and host filtering answers `400` to any other `Host`. Keep `AllowedHosts` and the probe `Host` in sync | liveness + readiness `GET /healthz` (`location = /healthz { access_log off; return 200; }`), no `Host` header |
| Resources | 0.25 vCPU / 0.5 GiB | 0.25 vCPU / 0.5 GiB |
| Scale | min **0**, max 2, HTTP rule 50 concurrent requests | min **0**, max 2, HTTP rule 50 concurrent requests |

Migration image: `src/backend/Migrate.Dockerfile`, build context = **repository root**, ignore file `src/backend/Migrate.Dockerfile.dockerignore`; details in 10.5 (0.5 vCPU / 1 GiB).

**nginx (web) essentials:**
- SPA fallback: `location / { try_files $uri $uri/ /index.html; }`; `/api/` proxy as in 10.2.
- Caching: `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`; `index.html`, `sw.js`, `registerSW.js`, `workbox-*.js`, `manifest.webmanifest` → `Cache-Control: no-cache`.
- Security headers on every response (`add_header ... always`):
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000` (no `includeSubDomains`/`preload`: the domain is Azure's).
- `server_tokens off`; JSON access log to stdout.

**Cold start:** after idle, the first request may wait for the web replica, the API replica and SQL resume (up to ~1 min). Accepted (ADR-001, 7.4); nginx and the client timeouts are sized for it.

### 10.10 CI/CD (ADR-023)
**`ci.yml`** (pull requests to `main`; always runs, so required checks never stay "pending"):
| Job | Runs when | Steps |
|---|---|---|
| `changes` | always | `git diff --name-only` vs base → flags `backend`, `frontend`, `infra`, `e2e` (no third-party action) |
| `backend` | backend/tests changed | setup-dotnet (`global.json`), `dotnet restore`, `dotnet build -c Release`, `dotnet format --verify-no-changes`, `dotnet test -c Release` (Docker is available on `ubuntu-latest` for Testcontainers) |
| `frontend` | frontend changed | setup-node 24, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| `infra` | `infra/` changed | `az bicep build` + `az bicep lint` for each entry file (no Azure login) |
| `images` | Dockerfiles or app code changed | `docker build` of api, web, migrate (no push) |
| `e2e` | app or `tests/e2e` changed, once `tests/e2e` exists | `docker compose up --build -d`, Playwright, upload report on failure |
| `ci-ok` | always (`needs:` all, `if: always()`) | fails if any needed job failed/cancelled; skipped is OK. **This is the single required status check.** |

**`deploy.yml`** (push to `main`, `paths-ignore: docs/**, **/*.md`; plus `workflow_dispatch`; `permissions: id-token: write, contents: read`; `concurrency: deploy-production`, no cancel-in-progress):
1. `azure/login` (OIDC).
2. Deploy `infra/core.bicep`: Log Analytics, environment, ACR, identities + AcrPull assignments, SQL server/database. Outputs feed later steps.
3. Build and push `mytodoapp-{api,web,migrate}:<sha>`.
4. Deploy `infra/apps.bicep`: migrate job with the **new** image; API and web with their **currently running** images (read with `az containerapp show`; new SHA on first deployment).
5. Start `caj-mytodoapp-migrate`, poll the execution until `Succeeded` (timeout 10 min); on failure stop.
6. `az containerapp update --image ...:<sha>` for the API, then the web app.
7. Smoke test with retries for cold start (≤ 3 min): `GET https://<web>/healthz` → 200 and `GET https://<web>/api/v1/auth/me` → 401 (proves nginx → API).
- Single production target in v1. **Don't add `environment: production` to the job**: it changes the OIDC subject to `...:environment:production`, which the federated credential (ADR-005, `ref:refs/heads/main`) doesn't trust. Adding a GitHub environment later needs a new federated credential + ADR.
- Rollback = revert PR (redeploys the previous code; migrations are backward compatible).
- `az config set extension.use_dynamic_install=yes_without_prompt` for the `containerapp` CLI extension.

### 10.11 Observability
- Container Apps ship stdout/stderr to `log-mytodoapp` (`ContainerAppConsoleLogs_CL`, `ContainerAppSystemLogs_CL`), retention 30 days.
- API: JSON console formatter with scopes (trace id). Levels: `Default` Information, `Microsoft.AspNetCore` Warning, `Microsoft.EntityFrameworkCore` Warning. No `UseHttpLogging`, never `EnableSensitiveDataLogging` outside tests.
- Logged events: unexpected exceptions (Error, trace id, also returned as ProblemDetails `traceId`), account deleted (Information, user id), rate-limit rejections (Warning), migration job output.
- **No PII:** no emails, passwords, cookies, list names, task titles/notes. Ids only.
- Health: `/health` (API, no DB check) and `/healthz` (nginx) for probes only.
- Later (needs an ADR + package approval): Application Insights via Azure Monitor OpenTelemetry, alerts.

### 10.12 Testing strategy (ADR-022)
| Level | Project / tool | What | Notes |
|---|---|---|---|
| Domain unit | `MyTodoApp.Domain.UnitTests` (xUnit v3) | entity rules: Inbox guards, complete/uncomplete, trimming, ranges | pure, no I/O |
| Handler unit | `MyTodoApp.Application.UnitTests` | every handler: happy path, not found / not owned, conflicts, sorting, `truncated`, today boundaries | real `AppDbContext` on **SQLite in-memory** (one open connection per test, `EnsureCreated`); fast, relational, no Docker. SQL Server-specific behaviour (case-insensitive uniqueness, cascades, filtered index, migrations) is **not** asserted here |
| API integration | `MyTodoApp.Api.IntegrationTests` (`WebApplicationFactory`) | every endpoint: happy path, main failure, other user's data invisible (404); auth, 401, 429, ProblemDetails shapes, JSON formats | **SQL Server via Testcontainers** (`mcr.microsoft.com/mssql/server:2022-latest`): one container per test assembly (assembly fixture), one fresh database per test class created with `MigrateAsync()`; each test registers its own users. Cookie-aware `HttpClient` with `BaseAddress = https://localhost` (Secure cookie). Rate limit raised via config except in the 429 test |
| Frontend | Vitest + React Testing Library + jsdom | components, hooks, `apiFetch` error mapping, date helpers, offline state | `fetch` stubbed (`vi.stubGlobal`) or API modules mocked; `renderWithProviders` (QueryClient with `retry: false`, `MemoryRouter`); fake timers + explicit time zone |
| E2E | Playwright (`tests/e2e`) | main journeys: register → add task → Today → complete → Completed; lists CRUD; delete account; offline banner | against `docker compose up --build` at `http://localhost:8080` (real nginx proxy); Chromium desktop + mobile viewport; unique user per test; accessibility checks with axe |

- **Deterministic time:** a hand-written `FixedTimeProvider : TimeProvider` (overrides `GetUtcNow()`, settable) in each test project's `Common/`; integration tests swap it in via `ConfigureTestServices`. No real clock, no real network (containers are local).
- Test naming per `CLAUDE.md`. No assertion or mocking library (FluentAssertions v8 is commercial): xUnit `Assert` and hand-written fakes.
