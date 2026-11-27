using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MyTodoApp.Application.Common;
using MyTodoApp.Domain.Common;
using MyTodoApp.Domain.TaskLists;
using MyTodoApp.Domain.Tasks;
using MyTodoApp.Infrastructure.Identity;
using MyTodoApp.Infrastructure.TaskLists;

namespace MyTodoApp.Infrastructure.Persistence;

/// <summary>
/// The single <see cref="DbContext"/> (SPEC 10.4): Identity users (no role tables), <c>TaskLists</c>, <c>Tasks</c>
/// and the Data Protection key ring (<c>DataProtectionKeys</c>, ADR-020).
/// <list type="bullet">
/// <item>Saving a newly added <see cref="User"/> also adds its Inbox, in the same <c>SaveChanges</c> (ADR-012).</item>
/// <item>A unique index violation (SQL errors 2601/2627) becomes a <see cref="ConflictException"/>.</item>
/// </list>
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options, TimeProvider timeProvider)
    : IdentityUserContext<User, Guid>(options), IAppDbContext, IDataProtectionKeyContext
{
    public const string DuplicateListNameMessage = "A list with this name already exists.";
    public const string DuplicateInboxMessage = "This user already has an Inbox list.";
    public const string UniqueViolationMessage = "The change conflicts with existing data.";

    public DbSet<TaskList> TaskLists => Set<TaskList>();

    public DbSet<TodoTask> Tasks => Set<TodoTask>();

    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        AddInboxForNewUsers();
        try
        {
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }
        catch (DbUpdateException exception) when (IsUniqueIndexViolation(exception, out var sqlException))
        {
            throw ToConflict(sqlException);
        }
    }

    public override async Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        AddInboxForNewUsers();
        try
        {
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueIndexViolation(exception, out var sqlException))
        {
            throw ToConflict(sqlException);
        }
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Identity's tables keep their default names (AspNetUsers, AspNetUserClaims, ...).
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Applies to DateTime? too.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateOnly>().HaveColumnType("date");
        configurationBuilder.Properties<TaskPriority>().HaveConversion<int>();
    }

    /// <summary>
    /// <c>UserManager.CreateAsync</c> saves once, so user and Inbox are inserted in one transaction. Skips users
    /// that already have a pending Inbox (e.g. when a failed save is retried on the same context).
    /// </summary>
    private void AddInboxForNewUsers()
    {
        var newUserIds = ChangeTracker.Entries<User>()
            .Where(entry => entry.State == EntityState.Added)
            .Select(entry => entry.Entity.Id)
            .ToList();
        if (newUserIds.Count == 0)
        {
            return;
        }

        var pendingInboxOwners = ChangeTracker.Entries<TaskList>()
            .Where(entry => entry.State == EntityState.Added && entry.Entity.IsDefault)
            .Select(entry => entry.Entity.UserId)
            .ToHashSet();
        var now = timeProvider.GetUtcNow();

        foreach (var userId in newUserIds.Where(id => !pendingInboxOwners.Contains(id)))
        {
            TaskLists.Add(TaskList.CreateInbox(userId, now));
        }
    }

    private static bool IsUniqueIndexViolation(
        DbUpdateException exception,
        [NotNullWhen(true)] out SqlException? sqlException)
    {
        sqlException = exception.InnerException as SqlException;
        return sqlException is { Number: 2601 or 2627 };
    }

    // Handlers pre-check names; this only catches races. The message must not contain the duplicate value.
    private static ConflictException ToConflict(SqlException exception)
    {
        var message = exception.Message;
        if (message.Contains(TaskListConfiguration.UniqueNameIndex, StringComparison.Ordinal))
        {
            return new ConflictException(DuplicateListNameMessage);
        }

        if (message.Contains(TaskListConfiguration.UniqueInboxIndex, StringComparison.Ordinal))
        {
            return new ConflictException(DuplicateInboxMessage);
        }

        return new ConflictException(UniqueViolationMessage);
    }
}
