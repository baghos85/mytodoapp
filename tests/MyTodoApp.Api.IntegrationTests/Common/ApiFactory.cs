using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace MyTodoApp.Api.IntegrationTests.Common;

/// <summary>
/// Base <see cref="WebApplicationFactory{TEntryPoint}"/> for API integration tests: runs the real <c>Program</c>
/// (Development environment, so DI is validated on build), swaps in <see cref="Time"/> as the <see cref="TimeProvider"/> and maps the
/// test-only endpoints from <see cref="TestEndpoints"/>. Use one instance per test class (<c>IClassFixture</c>).
/// The data model issue adds the SQL Server (Testcontainers) database here.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public FixedTimeProvider Time { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Time);
            services.AddSingleton<IStartupFilter, TestEndpoints.StartupFilter>();
        });
    }
}
