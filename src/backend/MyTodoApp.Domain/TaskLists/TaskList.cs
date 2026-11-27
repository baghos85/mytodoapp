using MyTodoApp.Domain.Common;

namespace MyTodoApp.Domain.TaskLists;

/// <summary>
/// A user's list of tasks (SPEC 3.2). Every user has exactly one Inbox (<see cref="IsDefault"/>), created with the
/// user (ADR-012); it can't be renamed or deleted. <see cref="UserId"/> is a plain id: Domain doesn't know the
/// Identity user.
/// </summary>
public sealed class TaskList
{
    public const int NameMaxLength = 100;
    public const string InboxName = "Inbox";
    public const string InboxCannotBeRenamedMessage = "The Inbox list cannot be renamed.";
    public const string InboxCannotBeDeletedMessage = "The Inbox list cannot be deleted.";

    // Used by EF Core when materialising; it sets the properties through their private setters.
    private TaskList() => Name = string.Empty;

    private TaskList(Guid userId, string name, bool isDefault, DateTimeOffset now)
    {
        Id = Guid.CreateVersion7();
        UserId = userId;
        Name = name;
        IsDefault = isDefault;
        CreatedAt = now.UtcDateTime;
        UpdatedAt = CreatedAt;
    }

    public Guid Id { get; private set; }

    public Guid UserId { get; private set; }

    public string Name { get; private set; }

    public bool IsDefault { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    /// <summary>Creates a regular (non-default) list. The name is trimmed.</summary>
    /// <exception cref="DomainValidationException">The name is blank or longer than <see cref="NameMaxLength"/>.</exception>
    public static TaskList Create(Guid userId, string name, DateTimeOffset now) =>
        new(userId, ValidName(name), isDefault: false, now);

    /// <summary>Creates the user's Inbox (<see cref="IsDefault"/> = <c>true</c>, name <see cref="InboxName"/>).</summary>
    public static TaskList CreateInbox(Guid userId, DateTimeOffset now) =>
        new(userId, InboxName, isDefault: true, now);

    /// <summary>Renames the list. The name is trimmed; uniqueness per user is checked by the handler.</summary>
    /// <exception cref="ConflictException">The list is the Inbox.</exception>
    /// <exception cref="DomainValidationException">The name is blank or longer than <see cref="NameMaxLength"/>.</exception>
    public void Rename(string name, DateTimeOffset now)
    {
        if (IsDefault)
        {
            throw new ConflictException(InboxCannotBeRenamedMessage);
        }

        Name = ValidName(name);
        UpdatedAt = now.UtcDateTime;
    }

    /// <summary>Call before deleting the list (its tasks are deleted by the database cascade).</summary>
    /// <exception cref="ConflictException">The list is the Inbox.</exception>
    public void EnsureCanBeDeleted()
    {
        if (IsDefault)
        {
            throw new ConflictException(InboxCannotBeDeletedMessage);
        }
    }

    private static string ValidName(string name) => Text.Required(name, NameMaxLength, "name");
}
