namespace MyTodoApp.Domain.Common;

/// <summary>
/// The user is authenticated but not allowed to do this. Maps to <c>403</c>.
/// For resources owned by another user, throw <see cref="NotFoundException"/> instead (never leak existence).
/// Not sealed: features may derive specific exceptions.
/// </summary>
public class ForbiddenException(string message) : DomainException(message);
