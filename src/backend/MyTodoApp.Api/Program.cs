using MyTodoApp.Api.Common;
using MyTodoApp.Application.Common;
using MyTodoApp.Infrastructure.Common;

var builder = WebApplication.CreateBuilder(args);

// Fail fast on DI mistakes (missing registrations, captive dependencies) while developing (SPEC 10.3).
builder.Host.UseDefaultServiceProvider((context, options) =>
{
    var isDevelopment = context.HostingEnvironment.IsDevelopment();
    options.ValidateScopes = isDevelopment;
    options.ValidateOnBuild = isDevelopment;
});

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration);

// Code injects TimeProvider, never DateTime.Now/UtcNow; tests swap in a FixedTimeProvider.
builder.Services.AddSingleton(TimeProvider.System);

// Errors are ProblemDetails (RFC 9457); the global ExceptionHandler maps domain and unexpected exceptions.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ExceptionHandler>();

// Built-in Minimal API validation: DataAnnotations / IValidatableObject on request records.
builder.Services.AddValidation();

builder.Services.AddApiJson();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // /openapi/v1.json
}

// Anonymous liveness/readiness probe; does not touch the database (SPEC 4.8, ADR-016).
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();
