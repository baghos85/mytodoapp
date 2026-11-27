using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace MyTodoApp.Api.IntegrationTests.Common;

/// <summary>
/// Request binding errors (<c>BadHttpRequestException</c>) must be 400 / 415 ProblemDetails in every environment,
/// never a 500, without the framework's message and without an Error log.
/// </summary>
public sealed class BadRequestTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string ProblemJson = "application/problem+json";
    private const string BodyPath = TestEndpoints.Prefix + "/body";

    public static TheoryData<string, string, string, HttpStatusCode> InvalidRequests => new()
    {
        { "Development", """{"title": "x",""", "application/json", HttpStatusCode.BadRequest },
        { "Development", """{"title": "x", "dueDate": "not-a-date", "priority": "low"}""", "application/json", HttpStatusCode.BadRequest },
        { "Development", """{"title": "x", "priority": "urgent"}""", "application/json", HttpStatusCode.BadRequest },
        { "Development", "", "application/json", HttpStatusCode.BadRequest },
        { "Development", """{"title": "x"}""", "text/plain", HttpStatusCode.UnsupportedMediaType },
        { "Production", """{"title": "x",""", "application/json", HttpStatusCode.BadRequest },
        { "Production", """{"title": "x"}""", "text/plain", HttpStatusCode.UnsupportedMediaType },
    };

    [Fact]
    public async Task ValidBody_Posted_Returns200()
    {
        using var client = factory.CreateClient();
        using var content = Json("""{"title": "x", "dueDate": "2026-11-27", "priority": "veryHigh"}""", "application/json");

        using var response = await client.PostAsync(BodyPath, content, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task InvalidBody_Posted_ReturnsProblemDetailsWithoutDetailOrErrorLog(
        string environment, string body, string contentType, HttpStatusCode expectedStatus)
    {
        var logs = new CapturingLoggerProvider();
        await using var host = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.ConfigureServices(services => services.AddSingleton<ILoggerProvider>(logs));
        });
        using var client = host.CreateClient();
        using var content = Json(body, contentType);

        using var response = await client.PostAsync(BodyPath, content, TestContext.Current.CancellationToken);

        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var problem = JsonDocument.Parse(text);
        var root = problem.RootElement;
        Assert.Equal((int)expectedStatus, root.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrEmpty(root.GetProperty("title").GetString()));
        Assert.StartsWith("https://tools.ietf.org/html/rfc9110#section-15.5.", root.GetProperty("type").GetString());
        Assert.False(string.IsNullOrEmpty(root.GetProperty("traceId").GetString()));
        Assert.False(root.TryGetProperty("detail", out _));
        Assert.DoesNotContain(nameof(TestEndpoints.SampleBody), text, StringComparison.Ordinal);
        Assert.DoesNotContain(logs.Entries, e => e.Level >= LogLevel.Error);
    }

    private static StringContent Json(string body, string contentType) =>
        new(body, Encoding.UTF8, contentType);
}
