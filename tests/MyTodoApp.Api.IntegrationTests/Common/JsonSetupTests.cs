using System.Net;

namespace MyTodoApp.Api.IntegrationTests.Common;

public sealed class JsonSetupTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Response_WithEnumAndProperties_SerializesCamelCase()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(TestEndpoints.Prefix + "/json", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            """{"priority":"veryHigh","displayName":"Sample"}""",
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }
}
