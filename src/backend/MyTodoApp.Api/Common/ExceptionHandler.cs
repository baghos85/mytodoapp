using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MyTodoApp.Domain.Common;

namespace MyTodoApp.Api.Common;

/// <summary>
/// The single global exception handler (SPEC 4.1, 10.3). Maps domain exceptions to ProblemDetails
/// (404 / 409 / 403 / 400 with <c>errors[field]</c>); anything else becomes a generic 500 that never contains
/// the exception message or stack trace, and is logged at Error with the trace id returned to the client.
/// </summary>
public sealed partial class ExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ExceptionHandler> logger) : IExceptionHandler
{
    public const string UnexpectedErrorTitle = "An unexpected error occurred.";
    private const string ProblemJsonContentType = "application/problem+json";

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
            NotFoundException e => new ProblemDetails { Status = StatusCodes.Status404NotFound, Detail = e.Message },
            ConflictException e => new ProblemDetails { Status = StatusCodes.Status409Conflict, Detail = e.Message },
            ForbiddenException e => new ProblemDetails { Status = StatusCodes.Status403Forbidden, Detail = e.Message },
            _ => CreateUnexpectedErrorProblem(httpContext, exception),
        };

        httpContext.Response.StatusCode = problem.Status!.Value;

        var written = await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
        });

        if (!written)
        {
            // No IProblemDetailsWriter accepted the request's Accept header: still answer with problem+json.
            await httpContext.Response.WriteAsJsonAsync(
                problem, problem.GetType(), options: null, ProblemJsonContentType, cancellationToken);
        }

        return true;
    }

    private ProblemDetails CreateUnexpectedErrorProblem(HttpContext httpContext, Exception exception)
    {
        var traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier;
        LogUnexpectedException(exception, httpContext.Request.Method, httpContext.Request.Path, traceId);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = UnexpectedErrorTitle,
        };
        problem.Extensions["traceId"] = traceId;
        return problem;
    }

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Unexpected exception while handling {RequestMethod} {RequestPath} (trace id {TraceId})")]
    private partial void LogUnexpectedException(
        Exception exception, string requestMethod, PathString requestPath, string traceId);
}
