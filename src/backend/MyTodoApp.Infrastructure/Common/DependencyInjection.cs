using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MyTodoApp.Infrastructure.Common;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the Infrastructure layer. Empty for now: the data model issue adds <c>AppDbContext</c>
    /// (connection string <c>ConnectionStrings:AppDb</c>), the auth issue adds Identity and Data Protection.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        return services;
    }
}
