using System.Text.Json;
using System.Text.Json.Serialization;

namespace MyTodoApp.Api.Common;

public static class JsonSetup
{
    /// <summary>
    /// JSON conventions for every Minimal API request and response (SPEC 4.1, 10.3): camelCase properties
    /// (the web default) and enums as camelCase strings (e.g. <c>"medium"</c>). Unknown properties are ignored (default).
    /// </summary>
    public static IServiceCollection AddApiJson(this IServiceCollection services)
    {
        return services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
    }
}
