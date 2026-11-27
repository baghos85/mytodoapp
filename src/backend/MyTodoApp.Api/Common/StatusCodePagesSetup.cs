using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace MyTodoApp.Api.Common;

public static class StatusCodePagesSetup
{
    /// <summary>
    /// Gives empty error responses a ProblemDetails body, e.g. the framework's <c>415</c> for a non-JSON
    /// <c>Content-Type</c> (Minimal APIs set it without throwing) or <c>405</c>.
    /// <para>
    /// <b>Except <c>404</c>, until the auth issue (#8):</b> the deploy smoke test accepts <c>GET /api/v1/auth/me</c>
    /// only as <c>401</c> or as a <c>404</c> with an <b>empty</b> body. #8 removes this exception together with
    /// tightening the smoke test to <c>401</c> (and updates <c>UnknownRoute_BeforeAuthIssue_Returns404WithEmptyBody</c>).
    /// </para>
    /// </summary>
    public static IApplicationBuilder UseProblemDetailsStatusCodePages(this IApplicationBuilder app)
    {
        return app.UseStatusCodePages(WriteAsync);
    }

    private static Task WriteAsync(StatusCodeContext context)
    {
        var httpContext = context.HttpContext;
        if (httpContext.Response.StatusCode == StatusCodes.Status404NotFound)
        {
            return Task.CompletedTask;
        }

        var problemDetailsService = httpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        return ProblemDetailsWriter.WriteAsync(
            httpContext,
            problemDetailsService,
            new ProblemDetails { Status = httpContext.Response.StatusCode },
            httpContext.RequestAborted);
    }
}
