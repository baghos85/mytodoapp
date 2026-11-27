using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace MyTodoApp.Infrastructure.Persistence;

/// <summary>
/// Stores every <see cref="DateTime"/> as UTC and reads it back with <see cref="DateTimeKind.Utc"/> (SPEC 10.4).
/// Without it EF returns <see cref="DateTimeKind.Unspecified"/> and the JSON loses its <c>Z</c>.
/// Local times are converted to UTC; unspecified times are taken to be UTC already.
/// </summary>
public sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    value => ToUtc(value),
    value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
{
    private static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
