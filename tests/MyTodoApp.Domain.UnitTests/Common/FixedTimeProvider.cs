namespace MyTodoApp.Domain.UnitTests.Common;

/// <summary>
/// Deterministic <see cref="TimeProvider"/> for tests (ADR-022): returns <see cref="UtcNow"/> until a test changes it.
/// The local time zone is UTC, so nothing depends on the machine running the tests.
/// </summary>
public sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    /// <summary>Default "now" for tests: 2026-11-27 09:30:00 UTC.</summary>
    public static readonly DateTimeOffset DefaultUtcNow = new(2026, 11, 27, 9, 30, 0, TimeSpan.Zero);

    public FixedTimeProvider()
        : this(DefaultUtcNow)
    {
    }

    public DateTimeOffset UtcNow { get; set => field = value.ToUniversalTime(); } = utcNow.ToUniversalTime();

    public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;

    public override DateTimeOffset GetUtcNow() => UtcNow;

    public void Advance(TimeSpan delta) => UtcNow += delta;
}
