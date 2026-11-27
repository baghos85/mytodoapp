namespace MyTodoApp.Application.Common;

/// <summary>
/// Handles one command (a use case that changes state). One handler per use case, in
/// <c>Application/&lt;Feature&gt;/&lt;Action&gt;/</c>. Registered automatically by
/// <see cref="DependencyInjection.AddApplication"/>; endpoints inject this interface and call it directly.
/// </summary>
public interface ICommandHandler<in TCommand, TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken ct);
}
