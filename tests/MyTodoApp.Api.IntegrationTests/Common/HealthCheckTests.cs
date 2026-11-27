using System.Net;

namespace MyTodoApp.Api.IntegrationTests.Common;

public sealed class HealthCheckTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task GetHealth_Anonymous_Returns200PlainTextHealthy()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }
}
