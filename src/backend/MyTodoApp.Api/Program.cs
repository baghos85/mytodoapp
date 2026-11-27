// Hello-world placeholder (issue #5) so the pipeline has something to build and deploy.
// The backend scaffold issue replaces this file.
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();

var app = builder.Build();

// Anonymous liveness/readiness probe; does not touch the database (SPEC 4.8, ADR-016).
app.MapHealthChecks("/health");

app.Run();
