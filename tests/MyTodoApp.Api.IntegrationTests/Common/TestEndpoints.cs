using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using MyTodoApp.Domain.Common;

namespace MyTodoApp.Api.IntegrationTests.Common;

/// <summary>
/// Endpoints that exist only in the test host, to exercise cross-cutting behaviour (exception mapping, JSON)
/// before any feature endpoint exists. They are mapped after the app's own pipeline, so requests still pass
/// through the app's middleware (exception handler) exactly like feature endpoints.
/// </summary>
public static class TestEndpoints
{
    public const string Prefix = "/_test";

    /// <summary>Exception message that must never reach the client.</summary>
    public const string SecretMessage = "Sensitive internal detail 7f3c9a";

    public enum SamplePriority
    {
        Low = 1,
        VeryHigh = 2,
    }

    public sealed record SampleDto(SamplePriority Priority, string DisplayName);

    private static void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(Prefix);

        group.MapGet("/not-found", () => Throw(new NotFoundException("Thing not found.")));
        group.MapGet("/conflict", () => Throw(new ConflictException("A thing with this name already exists.")));
        group.MapGet("/forbidden", () => Throw(new ForbiddenException("You may not do this.")));
        group.MapGet("/validation", () => Throw(new DomainValidationException("TimeZone", "The time zone is missing or unknown.")));
        group.MapGet("/unexpected", () => Throw(new InvalidOperationException(SecretMessage)));
        group.MapGet("/json", () => TypedResults.Ok(new SampleDto(SamplePriority.VeryHigh, "Sample")));
    }

    private static IResult Throw(Exception exception) => throw exception;

    internal sealed class StartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);
            app.UseRouting();
            app.UseEndpoints(Map);
        };
    }
}
