namespace MyTodoApp.Domain.Common;

/// <summary>
/// The request conflicts with the current state (duplicate name, limit reached, protected resource). Maps to <c>409</c>.
/// Not sealed: features may derive specific exceptions.
/// </summary>
public class ConflictException(string message) : DomainException(message);
