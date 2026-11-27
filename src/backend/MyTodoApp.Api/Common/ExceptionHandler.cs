using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MyTodoApp.Domain.Common;

namespace MyTodoApp.Api.Common;

/// <summary>
/// The single global exception handler (SPEC 4.1, 10.3). Maps domain exceptions to ProblemDetails
/// (404 / 409 / 403 / 400 with <c>errors[field]</c>) and request binding errors (<see cref="BadHttpRequestException"/>)
/// to their own status (400) without the framework's message. Anything else becomes a generic 500 that never
/// contains the exception message or stack trace, and is logged at Error with the trace id returned to the client.
/// </summary>
public sealed partial class ExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ExceptionHandler> logger) : IExceptionHandler
{
    public const string UnexpectedErrorTitle = "An unexpected error occurred.";

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var problem = exception switch
        {
            DomainValidationException e => new HttpValidationProblemDetails(
                new Dictionary<string, string[]> { [JsonNamingPolicy.CamelCase.ConvertName(e.Field)] = [e.Message] })
            {
                Status = StatusCodes.Status400BadRequest,
            },
            NotFoundException e => Create(StatusCodes.Status404NotFound, e.Message),
            ConflictException e => Create(StatusCodes.Status409Conflict, e.Message),
            ForbiddenException e => Create(StatusCodes.Status403Forbidden, e.Message),
            // Malformed JSON, wrong JSON types, missing body (thrown because ThrowOnBadRequest is on, see Program.cs).
            // The framework message names parameters and types, so it is not returned. Client error: no Error log.
            BadHttpRequestException e => Create(e.StatusCode, detail: null),
            _ => CreateUnexpectedErrorProblem(httpContext, exception),
        };

        await ProblemDetailsWriter.WriteAsync(httpContext, problemDetailsService, problem, cancellationToken);
        return true;
    }

    private static ProblemDetails Create(int status, string? detail) => new() { Status = status, Detail = detail };

    private ProblemDetails CreateUnexpectedErrorProblem(HttpContext httpContext, Exception exception)
    {
        LogUnexpectedException(
            exception,
            httpContext.Request.Method,
            httpContext.Request.Path,
            ProblemDetailsWriter.GetTraceId(httpContext));

        return new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = UnexpectedErrorTitle,
        };
    }

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Unexpected exception while handling {RequestMethod} {RequestPath} (trace id {TraceId})")]
    private partial void LogUnexpectedException(
        Exception exception, string requestMethod, PathString requestPath, string traceId);
}
