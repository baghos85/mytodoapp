using Microsoft.EntityFrameworkCore;
using MyTodoApp.Domain.TaskLists;
using MyTodoApp.Domain.Tasks;

namespace MyTodoApp.Application.Common;

/// <summary>
/// The application's view of the database (ADR-021), implemented by Infrastructure's <c>AppDbContext</c>.
/// Every query must filter by the current user's id (no global query filters). Users are reached only through
/// <c>IIdentityService</c>.
/// </summary>
public interface IAppDbContext
{
    DbSet<TaskList> TaskLists { get; }

    DbSet<TodoTask> Tasks { get; }

    /// <summary>
    /// Saves all changes in one transaction. A unique index violation (e.g. a concurrent duplicate list name)
    /// throws <see cref="Domain.Common.ConflictException"/>.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
