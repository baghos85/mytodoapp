namespace MyTodoApp.Domain.Common;

/// <summary>
/// A business rule rejected the value of one input field. Maps to <c>400</c> <c>ValidationProblemDetails</c> with
/// <c>errors[field]</c> (field name converted to camelCase), e.g. <c>new DomainValidationException("timeZone", "...")</c>.
/// Use this for rules that DataAnnotations on the request can't express; format/length rules belong on the request.
/// Not sealed: features may derive specific exceptions.
/// </summary>
public class DomainValidationException : DomainException
{
    public DomainValidationException(string field, string message)
        : base(message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(field);
        Field = field;
    }

    /// <summary>Name of the invalid input field, as in the request contract (e.g. <c>password</c>).</summary>
    public string Field { get; }
}
