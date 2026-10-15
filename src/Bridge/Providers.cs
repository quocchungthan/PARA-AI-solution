namespace Bridge;

public record ProviderStatus(string Name, bool Available, string Detail);

// Every provider is optional: each is probed at startup and only available ones are used.
// Probes are metadata-only (model list), never a billed generation request.
public static class Providers
{
    const string C = "providers";
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(10) };

    public static List<ProviderStatus> Status { get; private set; } = new();

    public static async Task<List<ProviderStatus>> ProbeExternalAsync()
    {
        var list = new List<ProviderStatus>
        {
            await ProbeAsync("claude", "ANTHROPIC_API_KEY", key =>
            {
                var r = new HttpRequestMessage(HttpMethod.Get, "https://api.anthropic.com/v1/models?limit=1");
                r.Headers.Add("x-api-key", key);
                r.Headers.Add("anthropic-version", "2023-06-01");
                return r;
            }),
            await ProbeAsync("gemini", "GEMINI_API_KEY", key =>
            {
                var r = new HttpRequestMessage(HttpMethod.Get, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1");
                r.Headers.Add("x-goog-api-key", key);
                return r;
            }),
            // Antigravity has no documented callable API or .NET SDK, so it stays disabled.
            new ProviderStatus("antigravity", false, "no documented API/.NET SDK; disabled"),
        };
        Status = list;
        return list;
    }

    public static void Report(ProviderStatus copilot)
    {
        Status = Status.Where(s => s.Name != "copilot").Prepend(copilot).ToList();
        foreach (var s in Status)
            if (s.Available) Log.Info(C, $"{s.Name}: available ({s.Detail})");
            else Log.Warn(C, $"{s.Name}: unavailable ({s.Detail})");
    }

    static async Task<ProviderStatus> ProbeAsync(string name, string envVar, Func<string, HttpRequestMessage> request)
    {
        var key = Environment.GetEnvironmentVariable(envVar);
        if (string.IsNullOrWhiteSpace(key)) return new(name, false, $"{envVar} not set");
        try
        {
            using var res = await Http.SendAsync(request(key));
            return res.IsSuccessStatusCode
                ? new(name, true, "credentials verified via model list")
                : new(name, false, $"credential check failed: HTTP {(int)res.StatusCode}");
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            return new(name, false, $"credential check failed: {e.GetType().Name}");
        }
    }
}
