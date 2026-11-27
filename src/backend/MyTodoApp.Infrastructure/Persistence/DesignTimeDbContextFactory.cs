using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MyTodoApp.Infrastructure.Persistence;

/// <summary>
/// Creates the <see cref="AppDbContext"/> for <c>dotnet ef</c> (migrations add, database update, migrations bundle)
/// without starting the API host. Connection string: <c>ConnectionStrings__AppDb</c> from the environment, else a
/// local default without credentials (enough for <c>migrations add</c>, which doesn't connect). The migration
/// bundle gets its connection with <c>--connection</c>.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string LocalConnectionString =
        "Server=localhost,1433;Database=MyTodoApp;Integrated Security=True;Encrypt=True;TrustServerCertificate=True";

    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(
            $"ConnectionStrings__{SqlServerOptions.ConnectionStringName}");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseAppSqlServer(string.IsNullOrWhiteSpace(connectionString) ? LocalConnectionString : connectionString)
            .Options;

        return new AppDbContext(options, TimeProvider.System);
    }
}
