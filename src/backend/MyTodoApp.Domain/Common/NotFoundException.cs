namespace MyTodoApp.Domain.Common;

/// <summary>
/// The resource does not exist <b>or is owned by another user</b> (never leak existence). Maps to <c>404</c>.
/// Not sealed: features may derive specific exceptions (e.g. <c>TaskNotFoundException</c>).
/// </summary>
public class NotFoundException(string message) : DomainException(message);
