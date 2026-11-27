using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MyTodoApp.Application.Common;
using MyTodoApp.Infrastructure.Common;

namespace MyTodoApp.Application.UnitTests.Common;

public sealed class DependencyInjectionTests
{
    private static readonly Type[] HandlerInterfaces = [typeof(ICommandHandler<,>), typeof(IQueryHandler<,>)];

    [Fact]
    public void AddHandlersFromAssembly_CommandAndQueryHandlers_RegistersEachScopedUnderItsInterface()
    {
        var services = new ServiceCollection();

        services.AddHandlersFromAssembly(typeof(DependencyInjectionTests).Assembly);

        AssertRegistered<ICommandHandler<SampleCommand, int>, SampleCommandHandler>(services);
        AssertRegistered<IQueryHandler<SampleQuery, string>, SampleQueryHandler>(services);
    }

    [Fact]
    public void AddHandlersFromAssembly_ClassImplementingSeveralHandlers_RegistersEveryInterface()
    {
        var services = new ServiceCollection();

        services.AddHandlersFromAssembly(typeof(DependencyInjectionTests).Assembly);

        AssertRegistered<ICommandHandler<OtherCommand, int>, MultiHandler>(services);
        AssertRegistered<IQueryHandler<OtherQuery, int>, MultiHandler>(services);
    }

    [Fact]
    public void AddHandlersFromAssembly_AbstractOpenGenericAndNonHandlerTypes_AreNotRegistered()
    {
        var services = new ServiceCollection();

        services.AddHandlersFromAssembly(typeof(DependencyInjectionTests).Assembly);

        Assert.DoesNotContain(services, d => d.ImplementationType == typeof(AbstractCommandHandler));
        Assert.DoesNotContain(services, d => d.ImplementationType is { IsGenericTypeDefinition: true });
        Assert.DoesNotContain(services, d => d.ImplementationType == typeof(NotAHandler));
        Assert.All(services, d => Assert.True(IsHandlerInterface(d.ServiceType)));
    }

    [Fact]
    public void AddHandlersFromAssembly_RegisteredHandlers_ResolveFromAScope()
    {
        var services = new ServiceCollection();
        services.AddHandlersFromAssembly(typeof(DependencyInjectionTests).Assembly);
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateOnBuild = true,
            ValidateScopes = true,
        });
        using var scope = provider.CreateScope();

        var handler = scope.ServiceProvider.GetRequiredService<ICommandHandler<SampleCommand, int>>();

        Assert.IsType<SampleCommandHandler>(handler);
    }

    /// <summary>
    /// Every handler in the Application assembly must resolve with the real Application + Infrastructure
    /// registrations. Keeps passing (and keeps checking) as handlers are added; register test doubles here only
    /// for services the Api provides (e.g. <c>ICurrentUser</c>).
    /// </summary>
    [Fact]
    public void AddApplication_EveryHandlerInApplicationAssembly_Resolves()
    {
        var services = new ServiceCollection();
        services.AddSingleton<TimeProvider>(new FixedTimeProvider());
        services.AddApplication().AddInfrastructure(new ConfigurationBuilder().Build());
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateOnBuild = true,
            ValidateScopes = true,
        });
        using var scope = provider.CreateScope();

        var handlerInterfaces = typeof(ICommandHandler<,>).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false, ContainsGenericParameters: false })
            .SelectMany(t => t.GetInterfaces().Where(IsHandlerInterface).Select(i => (Implementation: t, Interface: i)))
            .ToList();

        foreach (var (implementation, handlerInterface) in handlerInterfaces)
        {
            var resolved = scope.ServiceProvider.GetServices(handlerInterface);
            Assert.Contains(resolved, h => h?.GetType() == implementation);
        }
    }

    private static bool IsHandlerInterface(Type type) =>
        type.IsGenericType && HandlerInterfaces.Contains(type.GetGenericTypeDefinition());

    private static void AssertRegistered<TService, TImplementation>(IServiceCollection services)
    {
        var descriptor = Assert.Single(services, d => d.ServiceType == typeof(TService));
        Assert.Equal(typeof(TImplementation), descriptor.ImplementationType);
        Assert.Equal(ServiceLifetime.Scoped, descriptor.Lifetime);
    }

    // Test doubles scanned by AddHandlersFromAssembly (this test assembly contains no other handlers).
    internal sealed record SampleCommand;

    internal sealed record SampleQuery;

    internal sealed record OtherCommand;

    internal sealed record OtherQuery;

    internal sealed class SampleCommandHandler : ICommandHandler<SampleCommand, int>
    {
        public Task<int> HandleAsync(SampleCommand command, CancellationToken ct) => Task.FromResult(1);
    }

    internal sealed class SampleQueryHandler : IQueryHandler<SampleQuery, string>
    {
        public Task<string> HandleAsync(SampleQuery query, CancellationToken ct) => Task.FromResult("result");
    }

    internal sealed class MultiHandler : ICommandHandler<OtherCommand, int>, IQueryHandler<OtherQuery, int>
    {
        public Task<int> HandleAsync(OtherCommand command, CancellationToken ct) => Task.FromResult(2);

        public Task<int> HandleAsync(OtherQuery query, CancellationToken ct) => Task.FromResult(3);
    }

    internal abstract class AbstractCommandHandler : ICommandHandler<SampleCommand, int>
    {
        public abstract Task<int> HandleAsync(SampleCommand command, CancellationToken ct);
    }

    internal sealed class GenericQueryHandler<T> : IQueryHandler<T, int>
    {
        public Task<int> HandleAsync(T query, CancellationToken ct) => Task.FromResult(0);
    }

    internal sealed class NotAHandler;
}
