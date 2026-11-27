using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace MyTodoApp.Application.Common;

public static class DependencyInjection
{
    private static readonly Type[] HandlerInterfaces = [typeof(ICommandHandler<,>), typeof(IQueryHandler<,>)];

    /// <summary>
    /// Registers the Application layer: every handler in this assembly (scoped, under its handler interface).
    /// New handlers need no registration edit (ADR-021).
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        return services.AddHandlersFromAssembly(typeof(DependencyInjection).Assembly);
    }

    /// <summary>
    /// Registers every non-abstract, non-generic class in <paramref name="assembly"/> that implements a closed
    /// <see cref="ICommandHandler{TCommand,TResult}"/> or <see cref="IQueryHandler{TQuery,TResult}"/>, scoped,
    /// once per implemented handler interface. Plain reflection, no Scrutor.
    /// </summary>
    internal static IServiceCollection AddHandlersFromAssembly(this IServiceCollection services, Assembly assembly)
    {
        ArgumentNullException.ThrowIfNull(assembly);

        var implementations = assembly.GetTypes()
            .Where(type => type is { IsClass: true, IsAbstract: false, ContainsGenericParameters: false });

        foreach (var implementation in implementations)
        {
            var handlerInterfaces = implementation.GetInterfaces()
                .Where(i => i.IsGenericType && HandlerInterfaces.Contains(i.GetGenericTypeDefinition()));

            foreach (var handlerInterface in handlerInterfaces)
            {
                services.AddScoped(handlerInterface, implementation);
            }
        }

        return services;
    }
}
