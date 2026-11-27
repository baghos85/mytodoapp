using Microsoft.EntityFrameworkCore;

namespace MyTodoApp.Infrastructure.Persistence;

/// <summary>SQL Server provider settings shared by the app and <c>dotnet ef</c> (SPEC 10.4 Resilience).</summary>
internal static class SqlServerOptions
{
    public const string ConnectionStringName = "AppDb";

    /// <summary>
    /// Retries transient errors, e.g. while Azure SQL serverless resumes (about a minute; the connection string
    /// sets <c>Connect Timeout=60</c>). Explicit transactions must run inside
    /// <c>Database.CreateExecutionStrategy().ExecuteAsync(...)</c>.
    /// Never enable <c>EnableSensitiveDataLogging</c> here (SPEC 10.11).
    /// </summary>
    public static DbContextOptionsBuilder UseAppSqlServer(this DbContextOptionsBuilder options, string connectionString) =>
        options.UseSqlServer(
            connectionString,
            sql => sql.EnableRetryOnFailure(
                maxRetryCount: 6,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null));
}
