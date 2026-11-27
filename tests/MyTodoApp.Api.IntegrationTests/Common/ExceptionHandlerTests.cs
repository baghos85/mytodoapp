using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MyTodoApp.Api.Common;

namespace MyTodoApp.Api.IntegrationTests.Common;

public sealed class ExceptionHandlerTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string ProblemJson = "application/problem+json";

    [Theory]
    [InlineData("/not-found", HttpStatusCode.NotFound, "Not Found", "Thing not found.")]
    [InlineData("/conflict", HttpStatusCode.Conflict, "Conflict", "A thing with this name already exists.")]
    [InlineData("/forbidden", HttpStatusCode.Forbidden, "Forbidden", "You may not do this.")]
    public async Task DomainException_Thrown_ReturnsMatchingProblemDetails(
        string path, HttpStatusCode expectedStatus, string expectedTitle, string expectedDetail)
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(TestEndpoints.Prefix + path, TestContext.Current.CancellationToken);

        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        using var problem = await ReadJsonAsync(response);
        var root = problem.RootElement;
        Assert.Equal((int)expectedStatus, root.GetProperty("status").GetInt32());
        Assert.Equal(expectedTitle, root.GetProperty("title").GetString());
        Assert.Equal(expectedDetail, root.GetProperty("detail").GetString());
        Assert.StartsWith("https://tools.ietf.org/html/rfc9110#section-15.5.", root.GetProperty("type").GetString());
        Assert.False(string.IsNullOrEmpty(root.GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task DomainValidationException_Thrown_Returns400ValidationProblemWithCamelCaseField()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(
            TestEndpoints.Prefix + "/validation", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        using var problem = await ReadJsonAsync(response);
        var root = problem.RootElement;
        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Equal("One or more validation errors occurred.", root.GetProperty("title").GetString());
        Assert.Equal("https://tools.ietf.org/html/rfc9110#section-15.5.1", root.GetProperty("type").GetString());
        var errors = root.GetProperty("errors");
        var field = Assert.Single(errors.EnumerateObject());
        Assert.Equal("timeZone", field.Name);
        var message = Assert.Single(field.Value.EnumerateArray());
        Assert.Equal("The time zone is missing or unknown.", message.GetString());
    }

    [Fact]
    public async Task UnexpectedException_Thrown_Returns500WithoutExceptionDetails()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(
            TestEndpoints.Prefix + "/unexpected", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.DoesNotContain(TestEndpoints.SecretMessage, body, StringComparison.Ordinal);
        Assert.DoesNotContain(nameof(InvalidOperationException), body, StringComparison.Ordinal);
        Assert.DoesNotContain("   at ", body, StringComparison.Ordinal);
        using var problem = JsonDocument.Parse(body);
        var root = problem.RootElement;
        Assert.Equal(500, root.GetProperty("status").GetInt32());
        Assert.Equal("An unexpected error occurred.", root.GetProperty("title").GetString());
        Assert.False(root.TryGetProperty("detail", out _));
        Assert.False(string.IsNullOrEmpty(root.GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task UnexpectedException_Thrown_IsLoggedOnceAtErrorWithTemplateAndTraceId()
    {
        var logs = new CapturingLoggerProvider();
        await using var loggingFactory = factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.AddSingleton<ILoggerProvider>(logs)));
        using var client = loggingFactory.CreateClient();

        using var response = await client.GetAsync(
            TestEndpoints.Prefix + "/unexpected", TestContext.Current.CancellationToken);
        using var problem = await ReadJsonAsync(response);
        var traceId = problem.RootElement.GetProperty("traceId").GetString();

        var entry = Assert.Single(logs.Entries, e => e.Level >= LogLevel.Error);
        Assert.Equal(typeof(ExceptionHandler).FullName, entry.Category);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Equal(
            "Unexpected exception while handling {RequestMethod} {RequestPath} (trace id {TraceId})",
            entry.OriginalFormat);
        Assert.IsType<InvalidOperationException>(entry.Exception);
        Assert.Contains(traceId!, entry.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DomainException_AcceptHeaderWithoutJson_StillReturnsProblemJson()
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, TestEndpoints.Prefix + "/not-found");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/html"));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        using var problem = await ReadJsonAsync(response);
        Assert.Equal("Thing not found.", problem.RootElement.GetProperty("detail").GetString());
    }

    /// <summary>
    /// Until the auth issue lands, the deploy smoke test (deploy.yml) accepts <c>GET /api/v1/auth/me</c> only as
    /// <c>401</c> or as a <c>404</c> with an <b>empty</b> body. Adding status code pages (ProblemDetails bodies for
    /// empty error responses) must happen together with tightening that check to <c>401</c>; update this test then.
    /// </summary>
    [Fact]
    public async Task UnknownRoute_BeforeAuthIssue_Returns404WithEmptyBody()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/v1/auth/me", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken));
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        var stream = await response.Content.ReadAsStreamAsync(TestContext.Current.CancellationToken);
        return await JsonDocument.ParseAsync(stream, cancellationToken: TestContext.Current.CancellationToken);
    }
}
