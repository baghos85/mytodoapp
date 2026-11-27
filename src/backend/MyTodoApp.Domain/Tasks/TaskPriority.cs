namespace MyTodoApp.Domain.Tasks;

/// <summary>Priority of a <see cref="TodoTask"/>. Stored as int, serialised as camelCase string (SPEC 3.3).</summary>
public enum TaskPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
}
