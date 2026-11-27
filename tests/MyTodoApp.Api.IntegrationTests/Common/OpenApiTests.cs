using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace MyTodoApp.Api.IntegrationTests.Common;

public sealed class OpenApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task GetOpenApiDocument_Development_Returns200()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/openapi/v1.json", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetOpenApiDocument_Production_Returns404()
    {
        await using var production = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Production"));
        using var client = production.CreateClient();

        using var response = await client.GetAsync("/openapi/v1.json", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
