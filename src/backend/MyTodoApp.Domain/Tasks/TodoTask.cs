using MyTodoApp.Domain.Common;

namespace MyTodoApp.Domain.Tasks;

/// <summary>
/// A task (SPEC 3.3). Always belongs to a list (<see cref="ListId"/>, ADR-012) and carries its owner
/// (<see cref="UserId"/>, denormalised, ADR-015): callers must keep it equal to the list's <c>UserId</c>.
/// <see cref="CompletedAt"/> is set only by <see cref="Complete"/> and cleared only by <see cref="Uncomplete"/>.
/// </summary>
public sealed class TodoTask
{
    public const int TitleMaxLength = 200;
    public const int NotesMaxLength = 2000;
    public static readonly DateOnly MinDueDate = new(2000, 1, 1);
    public static readonly DateOnly MaxDueDate = new(2099, 12, 31);

    // Used by EF Core when materialising; it sets the properties through their private setters.
    private TodoTask() => Title = string.Empty;

    private TodoTask(
        Guid userId,
        Guid listId,
        string title,
        string? notes,
        DateOnly? dueDate,
        TaskPriority priority,
        DateTimeOffset now)
    {
        Id = Guid.CreateVersion7();
        UserId = userId;
        ListId = listId;
        Title = title;
        Notes = notes;
        DueDate = dueDate;
        Priority = priority;
        CreatedAt = now.UtcDateTime;
        UpdatedAt = CreatedAt;
    }

    public Guid Id { get; private set; }

    public Guid UserId { get; private set; }

    public Guid ListId { get; private set; }

    public string Title { get; private set; }

    public string? Notes { get; private set; }

    public DateOnly? DueDate { get; private set; }

    public TaskPriority Priority { get; private set; }

    public bool IsCompleted { get; private set; }

    public DateTime? CompletedAt { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    /// <summary>
    /// Creates an open task. The title is trimmed; blank notes become <c>null</c>.
    /// </summary>
    /// <exception cref="DomainValidationException">
    /// Blank or too long title, too long notes, due date outside <see cref="MinDueDate"/>..<see cref="MaxDueDate"/>,
    /// or an undefined priority.
    /// </exception>
    public static TodoTask Create(
        Guid userId,
        Guid listId,
        string title,
        string? notes,
        DateOnly? dueDate,
        TaskPriority priority,
        DateTimeOffset now) =>
        new(
            userId,
            listId,
            Text.Required(title, TitleMaxLength, "title"),
            Text.Optional(notes, NotesMaxLength, "notes"),
            ValidDueDate(dueDate),
            ValidPriority(priority),
            now);

    /// <summary>Marks the task completed. Idempotent: completing a completed task changes nothing.</summary>
    public void Complete(DateTimeOffset now)
    {
        if (IsCompleted)
        {
            return;
        }

        IsCompleted = true;
        CompletedAt = now.UtcDateTime;
        UpdatedAt = CompletedAt.Value;
    }

    /// <summary>Marks the task open again and clears <see cref="CompletedAt"/>. Idempotent.</summary>
    public void Uncomplete(DateTimeOffset now)
    {
        if (!IsCompleted)
        {
            return;
        }

        IsCompleted = false;
        CompletedAt = null;
        UpdatedAt = now.UtcDateTime;
    }

    /// <summary>
    /// Moves the task to another list. The handler checks that the list exists and belongs to the task's owner.
    /// </summary>
    public void MoveTo(Guid listId, DateTimeOffset now)
    {
        if (listId == ListId)
        {
            return;
        }

        ListId = listId;
        UpdatedAt = now.UtcDateTime;
    }

    private static DateOnly? ValidDueDate(DateOnly? dueDate)
    {
        if (dueDate is { } date && (date < MinDueDate || date > MaxDueDate))
        {
            throw new DomainValidationException(
                "dueDate", $"The due date must be between {MinDueDate:yyyy-MM-dd} and {MaxDueDate:yyyy-MM-dd}.");
        }

        return dueDate;
    }

    private static TaskPriority ValidPriority(TaskPriority priority) =>
        Enum.IsDefined(priority)
            ? priority
            : throw new DomainValidationException("priority", "The priority must be low, medium or high.");
}
