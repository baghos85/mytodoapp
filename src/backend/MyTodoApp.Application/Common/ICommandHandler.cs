namespace MyTodoApp.Application.Common;

/// <summary>
/// Handles one command (a use case that changes state) that returns a result, e.g. the created resource's DTO.
/// One handler per use case, in <c>Application/&lt;Feature&gt;/&lt;Action&gt;/</c>. Registered automatically by
/// <see cref="DependencyInjection.AddApplication"/>; endpoints inject this interface and call it directly.
/// </summary>
public interface ICommandHandler<in TCommand, TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken ct);
}

/// <summary>
/// Handles one command that returns nothing (endpoints answering <c>204 No Content</c>: rename, delete, complete...).
/// Same conventions and automatic registration as <see cref="ICommandHandler{TCommand,TResult}"/>.
/// </summary>
public interface ICommandHandler<in TCommand>
{
    Task HandleAsync(TCommand command, CancellationToken ct);
}
