namespace MyTodoApp.Domain.Common;

/// <summary>
/// String rules shared by the entities (SPEC 3): values are trimmed; required values must not be empty after
/// trimming; optional values that are empty or whitespace become <c>null</c>.
/// </summary>
internal static class Text
{
    /// <summary>
    /// Trims <paramref name="value"/> and checks it is 1 to <paramref name="maxLength"/> characters long.
    /// </summary>
    /// <exception cref="DomainValidationException">The value is missing, blank or too long.</exception>
    public static string Required(string? value, int maxLength, string field)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > maxLength)
        {
            throw new DomainValidationException(field, $"The {field} must be between 1 and {maxLength} characters.");
        }

        return trimmed;
    }

    /// <summary>
    /// Trims <paramref name="value"/>; empty or whitespace becomes <c>null</c>. Checks the trimmed length.
    /// </summary>
    /// <exception cref="DomainValidationException">The value is longer than <paramref name="maxLength"/>.</exception>
    public static string? Optional(string? value, int maxLength, string field)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        if (trimmed.Length > maxLength)
        {
            throw new DomainValidationException(field, $"The {field} must be at most {maxLength} characters.");
        }

        return trimmed;
    }
}
