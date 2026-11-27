using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MyTodoApp.Application.Common;
using MyTodoApp.Infrastructure.Persistence;

namespace MyTodoApp.Infrastructure.Common;

public static class DependencyInjection
{
    public const string DataProtectionApplicationName = "MyTodoApp";

    /// <summary>
    /// Registers the Infrastructure layer: <see cref="AppDbContext"/> on SQL Server (connection string
    /// <c>ConnectionStrings:AppDb</c>, read when the first context is created), <see cref="IAppDbContext"/>, and
    /// Data Protection with its key ring in the database (ADR-020). Requires a <see cref="TimeProvider"/>.
    /// The auth issue adds Identity.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddDbContext<AppDbContext>(options =>
        {
            var connectionString = configuration.GetConnectionString(SqlServerOptions.ConnectionStringName);
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"Connection string 'ConnectionStrings:{SqlServerOptions.ConnectionStringName}' is not configured.");
            }

            options.UseAppSqlServer(connectionString);
        });
        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());

        // Cookies survive restarts, scale-to-zero and new revisions; replicas share one key ring.
        services.AddDataProtection()
            .SetApplicationName(DataProtectionApplicationName)
            .PersistKeysToDbContext<AppDbContext>();

        return services;
    }
}
