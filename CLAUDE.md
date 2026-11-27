# MyTodoApp: Project Rules for Agents

A TODO web app (user accounts, lists, tasks with title / due date / done; filters for today, upcoming and completed), responsive and installable as a PWA. It is built by AI agents, coordinated through GitHub, and deployed to Azure.

**Before starting any task, read:** `docs/SPEC.md` (what we build), `docs/DECISIONS.md` (why things are the way they are) and `docs/LEARNINGS.md` (mistakes not to repeat).

## Stack

| Area | Choice |
|---|---|
| Backend | ASP.NET Core Web API on **.NET 10 (LTS)**, Minimal APIs |
| Data | EF Core, Azure SQL (SQL Server provider); migrations live in Infrastructure |
| Backend tests | xUnit, `WebApplicationFactory` for integration tests |
| Frontend | React + TypeScript (strict), Vite, React Router, TanStack Query |
| Frontend quality | ESLint + Prettier, Vitest + React Testing Library |
| E2E | Playwright |
| Hosting | Azure Container Apps: API and frontend as separate containers |
| IaC / CI/CD | Bicep in `infra/`, GitHub Actions in `.github/workflows/`, OIDC to Azure |

## Repository layout

```
src/
  backend/
    MyTodoApp.Domain/
    MyTodoApp.Application/
    MyTodoApp.Infrastructure/
    MyTodoApp.Api/
  frontend/                  # Vite app
tests/
  MyTodoApp.Domain.UnitTests/
  MyTodoApp.Application.UnitTests/
  MyTodoApp.Api.IntegrationTests/
  e2e/                       # Playwright
infra/                       # Bicep
docs/                        # SPEC.md, DECISIONS.md, LEARNINGS.md
```

## Backend architecture: Clean Architecture + light CQRS, organized by feature

### Layers and dependency rule
Dependencies point **inward only**: `Api → Application → Domain`, and `Infrastructure → Application → Domain`.
- **Domain**: entities, value objects, domain exceptions. No references to EF Core, ASP.NET or any NuGet package.
- **Application**: use cases (commands/queries + handlers), DTOs, and interfaces it needs (e.g. `IAppDbContext`, `ICurrentUser`, `IClock`). No reference to EF Core providers or ASP.NET.
- **Infrastructure**: EF Core `DbContext`, entity configurations, migrations, identity, implementations of Application interfaces.
- **Api**: Minimal API endpoints, request contracts, DI composition, auth, ProblemDetails, OpenAPI.

### Folder convention: Feature → Action
Application and Api (and their tests) use **`<Feature>/<Action>/`** folders. Domain and Infrastructure use **`<Feature>/`** only, because entities and configurations are shared across actions.

Example for the `Tasks` feature:
```
MyTodoApp.Domain/Tasks/
  TodoTask.cs
  TaskNotFoundException.cs
MyTodoApp.Application/Tasks/
  CreateTask/   CreateTaskCommand.cs   CreateTaskHandler.cs
  CompleteTask/ CompleteTaskCommand.cs CompleteTaskHandler.cs
  GetTasks/     GetTasksQuery.cs       GetTasksHandler.cs   TaskDto.cs
MyTodoApp.Infrastructure/Tasks/
  TodoTaskConfiguration.cs
MyTodoApp.Api/Tasks/
  TasksEndpoints.cs                 # MapGroup("/api/v1/tasks"), maps every action below
  CreateTask/   CreateTaskEndpoint.cs   CreateTaskRequest.cs
  GetTasks/     GetTasksEndpoint.cs
tests/MyTodoApp.Application.UnitTests/Tasks/
  CreateTask/   CreateTaskHandlerTests.cs
```
Cross-cutting code goes in a `Common/` folder in each project (e.g. `Application/Common/ICommandHandler.cs`, `Api/Common/ExceptionHandler.cs`).

### Light CQRS (no MediatR)
- Two interfaces of our own, in `Application/Common/`:
  `ICommandHandler<TCommand, TResult>` and `IQueryHandler<TQuery, TResult>`, each with `Task<TResult> HandleAsync(T request, CancellationToken ct)`.
- One handler per use case. Handlers are registered in DI; endpoints inject the handler and call it directly. No mediator or pipeline behaviors.
- Commands change state; queries never do. Queries use `AsNoTracking()` and project straight to DTOs.
- One database, one `DbContext`. No separate read models.
- **Do not add MediatR, AutoMapper or other commercial-licensed packages.** Map by hand (simple `ToDto()` methods). Ask before adding any new NuGet or npm package, and record why in `docs/DECISIONS.md`.

### API conventions
- Minimal APIs with `MapGroup` per feature, `TypedResults`, and built-in OpenAPI.
- Routes: `/api/v1/<plural-kebab-case>` (e.g. `/api/v1/task-lists/{listId}/tasks`). JSON is camelCase.
- Every endpoint requires authorization unless the spec says otherwise. Users can only ever see their own data: filter by the current user in every query.
- Correct status codes: `201 Created` + `Location` for creation, `204 No Content` for updates and deletes without a body, `404` for missing **or not owned** resources (never leak existence).

### Validation
- Use the **built-in .NET 10 Minimal API validation**: `builder.Services.AddValidation()` plus DataAnnotations (`[Required]`, `[StringLength]`, `[Range]`...) on request records.
- For rules that attributes can't express, implement `IValidatableObject` on the request.
- Business rules that need the database (e.g. "list name must be unique per user") belong in the handler and throw a domain exception.
- No FluentValidation.

### Error handling
- All errors are returned as **ProblemDetails (RFC 9457)**: `builder.Services.AddProblemDetails()`.
- Expected failures throw domain exceptions (`NotFoundException`, `ConflictException`, `ForbiddenException`, `DomainValidationException`) defined in `Domain/Common/`.
- One global `IExceptionHandler` in `Api/Common/` maps them to 404 / 409 / 403 / 400. Anything else returns a 500 with a generic message. **Never return stack traces or exception messages from unexpected errors.**
- Log unexpected exceptions with structured logging (`ILogger`, message templates, no string interpolation).

### C# coding standards
- Nullable reference types on, `TreatWarningsAsErrors` on, implicit usings on, file-scoped namespaces.
- `async` all the way, always pass `CancellationToken`, never `.Result` / `.Wait()`.
- Naming: PascalCase types/members, `_camelCase` private fields, `Async` suffix on async methods, `I` prefix on interfaces.
- Prefer `record` for commands, queries, DTOs and requests; `sealed` classes by default.
- Constructor injection only (primary constructors are fine). No service locator.
- Use `TimeProvider` (or `IClock`) instead of `DateTime.Now`, so time-based logic (today / upcoming) is testable. Store times as UTC.
- Code must pass `dotnet format --verify-no-changes`.

## Frontend conventions
- Feature folders mirror the backend: `src/features/<feature>/` (components, hooks, api calls, types), shared code in `src/shared/`.
- Function components and hooks only. Server state with TanStack Query; no global state library unless the spec needs one.
- Strict TypeScript: no `any`, no `@ts-ignore` without a comment explaining why.
- Mobile-first, responsive, accessible (semantic HTML, labels, keyboard navigation).
- PWA: web app manifest + service worker (vite-plugin-pwa).
- The API base URL comes from configuration, never hard-coded.
- Must pass `npm run lint`, `npm run typecheck` (or `tsc --noEmit`) and `npm test`.

## Testing rules
- Every handler and every piece of domain logic gets unit tests. Every endpoint gets at least one integration test (happy path + main failure case + "other user's data is not visible").
- Test naming: `MethodOrScenario_Condition_ExpectedResult`.
- Tests must be deterministic: no real clock, no real network, no shared state between tests.
- **All tests must pass before opening a PR.** Never delete or skip a failing test to make the build green; fix the cause or ask.

## Git & GitHub workflow
- **Every change goes through a pull request.** Never push to `main` directly. Never force-push to `main`.
- Branch naming: `feat/<issue>-<slug>` for features, `fix/<issue>-<slug>` for bugs, `chore/<slug>` for tooling/docs (e.g. `feat/12-create-task-endpoint`).
- Commit messages: Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`, `ci:`).
- One issue → one branch → one PR. Keep PRs small and focused on that issue.
- PR description: what changed, how it was tested, and `Closes #<issue>`.
- Before opening a PR, run locally: `dotnet build`, `dotnet test`, `dotnet format --verify-no-changes`, and in `src/frontend`: `npm run lint`, `npm run typecheck`, `npm test`.
- Merging to `main` requires passing CI and the owner's approval. Agents never merge their own PRs.

## Deployment & Azure
- **Never deploy manually.** Deployments happen only through `deploy.yml` on merge to `main`.
- Never create, change or delete Azure resources with `az` or the portal. All infrastructure changes go through Bicep in `infra/` and a PR.
- Everything lives in resource group `rg-mytodoapp` (France Central). Prefer cost-efficient settings (scale to zero, serverless SQL).

## Security
- **Never put secrets in code, config files, commits, issues, PRs or chat.** Use GitHub secrets, managed identity and Key Vault references.
- Local secrets go in `dotnet user-secrets` or `.env.local` (git-ignored).
- The app connects to Azure SQL with managed identity, not passwords.

## Learning loop
When the owner corrects you, or a build, test, review or deploy fails because of an avoidable mistake, add **one line** to `docs/LEARNINGS.md` in the same PR:
`- YYYY-MM-DD: <what went wrong> → <what fixed it / rule to follow>`
Keep entries short and specific. Do not record secrets or personal data.
