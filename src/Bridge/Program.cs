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

Log.Init(Path.Combine(dataDir, "bridge", "bridge.log"));
AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Error("fatal", "unhandled exception", e.ExceptionObject as Exception);

Log.Info("main", $"starting PARA bridge pid={Environment.ProcessId} root={root} dataDir={dataDir} poll={poll}s once={once} model={Env("PARA_MODEL") ?? "(default)"} envFile={(File.Exists(envFile) ? "loaded" : "missing")}");

CopilotClient client;
try
{
    client = new CopilotClient(new CopilotClientOptions { WorkingDirectory = root });
    Log.Info("main", "starting Copilot runtime (uses local Copilot sign-in)...");
    await client.StartAsync();
    Log.Info("main", "Copilot runtime started");
}
catch (Exception e)
{
    Log.Error("main", "cannot start Copilot runtime - is Copilot signed in on this machine?", e);
    return 1;
}

await using var _c = client;
var scanner = new Scanner(dataDir, Env("PARA_MODEL"), client);

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; Log.Info("main", "Ctrl+C received, stopping after current pass"); cts.Cancel(); };
do
{
    try { await scanner.RunOnceAsync(); }
    catch (Exception e) { Log.Error("main", "scan pass crashed (will retry)", e); }
    if (once) break;
    Log.Debug("main", $"sleeping {poll}s");
    try { await Task.Delay(TimeSpan.FromSeconds(poll), cts.Token); } catch (OperationCanceledException) { }
} while (!cts.IsCancellationRequested);
Log.Info("main", "bridge stopped");
return 0;
