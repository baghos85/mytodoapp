using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace MyTodoApp.Api.IntegrationTests.Common;

/// <summary>Hand-written logger provider that records log entries so tests can assert on them.</summary>
public sealed class CapturingLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<LogEntry> _entries = new();

    public IReadOnlyCollection<LogEntry> Entries => _entries.ToArray();

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, _entries);

    public void Dispose()
    {
    }

    public sealed record LogEntry(
        string Category,
        LogLevel Level,
        string Message,
        string? OriginalFormat,
        Exception? Exception);

    private sealed class CapturingLogger(string category, ConcurrentQueue<LogEntry> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            var originalFormat = (state as IEnumerable<KeyValuePair<string, object?>>)?
                .FirstOrDefault(kv => kv.Key == "{OriginalFormat}").Value as string;
            entries.Enqueue(new LogEntry(category, logLevel, formatter(state, exception), originalFormat, exception));
        }
    }
}
