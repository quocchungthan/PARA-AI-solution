using Bridge;
using GitHub.Copilot;

static string? Env(string k) => Environment.GetEnvironmentVariable(k) is { Length: > 0 } v ? v : null;

static string FindRoot()
{
    var d = new DirectoryInfo(AppContext.BaseDirectory);
    while (d != null && !Directory.Exists(Path.Combine(d.FullName, ".github"))) d = d.Parent;
    return d?.FullName ?? Directory.GetCurrentDirectory();
}

var root = FindRoot();

// Load .env (simple KEY=VALUE) without overriding real environment variables.
var envFile = Path.Combine(root, ".env");
if (File.Exists(envFile))
    foreach (var line in File.ReadAllLines(envFile))
    {
        var t = line.Trim();
        if (t.Length == 0 || t[0] == '#' || !t.Contains('=')) continue;
        var i = t.IndexOf('=');
        var k = t[..i].Trim();
        if (Env(k) is null && t[(i + 1)..].Trim() is { Length: > 0 } v) Environment.SetEnvironmentVariable(k, v);
    }

var dataDir = Path.GetFullPath(Env("PARA_DATA_DIR") ?? "data", root);
var poll = int.TryParse(Env("PARA_POLL_SECONDS"), out var p) ? p : 15;
var once = args.Contains("--once");

await using var client = new CopilotClient(new CopilotClientOptions
{
    WorkingDirectory = root,
});
await client.StartAsync();

var scanner = new Scanner(dataDir, root, Env("PARA_MODEL"), client);
Console.WriteLine($"PARA bridge watching {dataDir} every {poll}s (Ctrl+C to stop)");

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };
do
{
    try { await scanner.RunOnceAsync(); }
    catch (Exception e) { Console.WriteLine($"scan error: {e.Message}"); }
    if (once) break;
    try { await Task.Delay(TimeSpan.FromSeconds(poll), cts.Token); } catch (OperationCanceledException) { }
} while (!cts.IsCancellationRequested);
