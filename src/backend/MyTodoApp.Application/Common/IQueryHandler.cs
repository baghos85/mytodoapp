namespace MyTodoApp.Application.Common;

/// <summary>
/// Handles one query (a use case that never changes state; use <c>AsNoTracking()</c> and project straight to DTOs).
/// One handler per use case, in <c>Application/&lt;Feature&gt;/&lt;Action&gt;/</c>. Registered automatically by
/// <see cref="DependencyInjection.AddApplication"/>; endpoints inject this interface and call it directly.
/// </summary>
public interface IQueryHandler<in TQuery, TResult>
{
    Task<TResult> HandleAsync(TQuery query, CancellationToken ct);
}
