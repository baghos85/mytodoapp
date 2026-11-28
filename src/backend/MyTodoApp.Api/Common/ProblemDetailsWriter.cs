using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace MyTodoApp.Api.Common;

/// <summary>Writes a ProblemDetails response the same way for exceptions and for empty error responses.</summary>
internal static class ProblemDetailsWriter
{
    private const string ProblemJsonContentType = "application/problem+json";

    public static string GetTraceId(HttpContext httpContext) => Activity.Current?.Id ?? httpContext.TraceIdentifier;

    /// <summary>
    /// Sets status, <c>type</c>, <c>title</c> and <c>traceId</c> (what the framework defaults would add, so they are
    /// also present in the fallback), then writes through <see cref="IProblemDetailsService"/>. If no writer accepts
    /// the request's <c>Accept</c> header, still answers with <c>application/problem+json</c>.
    /// </summary>
    public static async Task WriteAsync(
        HttpContext httpContext,
        IProblemDetailsService problemDetailsService,
        ProblemDetails problem,
        CancellationToken ct)
    {
        var status = problem.Status ?? StatusCodes.Status500InternalServerError;
        problem.Status = status;
        problem.Type ??= TypeFor(status);
        problem.Title ??= ReasonPhrases.GetReasonPhrase(status);
        problem.Extensions.TryAdd("traceId", GetTraceId(httpContext));

        httpContext.Response.StatusCode = status;

        var written = await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
        });

        if (!written)
        {
            await httpContext.Response.WriteAsJsonAsync(
                problem, problem.GetType(), options: null, ProblemJsonContentType, ct);
        }
    }

    // Same RFC 9110 links the framework's ProblemDetails defaults use.
    private static string? TypeFor(int status) => status switch
    {
        StatusCodes.Status400BadRequest => "https://tools.ietf.org/html/rfc9110#section-15.5.1",
        StatusCodes.Status401Unauthorized => "https://tools.ietf.org/html/rfc9110#section-15.5.2",
        StatusCodes.Status403Forbidden => "https://tools.ietf.org/html/rfc9110#section-15.5.4",
        StatusCodes.Status404NotFound => "https://tools.ietf.org/html/rfc9110#section-15.5.5",
        StatusCodes.Status405MethodNotAllowed => "https://tools.ietf.org/html/rfc9110#section-15.5.6",
        StatusCodes.Status409Conflict => "https://tools.ietf.org/html/rfc9110#section-15.5.10",
        StatusCodes.Status413PayloadTooLarge => "https://tools.ietf.org/html/rfc9110#section-15.5.14",
        StatusCodes.Status415UnsupportedMediaType => "https://tools.ietf.org/html/rfc9110#section-15.5.16",
        StatusCodes.Status500InternalServerError => "https://tools.ietf.org/html/rfc9110#section-15.6.1",
        _ => null,
    };
}
