namespace MyTodoApp.Domain.Common;

/// <summary>
/// Base class for expected failures. The API's global exception handler maps each subclass to an HTTP status
/// (ProblemDetails) and uses <see cref="Exception.Message"/> as the response <c>detail</c>, so messages must be
/// safe to show to the user (no ids of other users, no PII).
/// </summary>
public abstract class DomainException(string message) : Exception(message);
