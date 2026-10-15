using System.Text.Json;

namespace Bridge;

// Local HTTP API for the static dashboard (web/).
public static class Api
{
    public const int Port = 5310;
    const string PagesOrigin = "https://quocchungthan.github.io";
    static readonly JsonSerializerOptions Compact = new(Json.Options) { WriteIndented = false };

    public static Task Start(string dataDir, CancellationToken ct)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls($"http://localhost:{Port}");
        builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
            .SetIsOriginAllowed(o => o == PagesOrigin || o.StartsWith("http://localhost:") || o.StartsWith("http://127.0.0.1:"))
            .AllowAnyHeader().AllowAnyMethod()
            .SetPreflightMaxAge(TimeSpan.FromMinutes(10))));

        var app = builder.Build();
        // Chrome's Private Network Access preflight needs this to let a public HTTPS page reach localhost.
        app.Use(async (ctx, next) =>
        {
            ctx.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
            await next();
        });
        app.UseCors();

        app.MapGet("/api/health", () => new { ok = true, tool = "para-bridge" });
        app.MapGet("/api/snapshot", () => Snapshot(dataDir));
        app.MapPost("/api/sessions/{sessionId}/reply", (string sessionId, SessionReplyRequest? request) =>
            QueueHumanReply(dataDir, sessionId, request));
        app.MapGet("/api/stream", async (HttpContext ctx) =>
        {
            ctx.Response.ContentType = "text/event-stream";
            ctx.Response.Headers.CacheControl = "no-cache";
            string? last = null;
            while (!ctx.RequestAborted.IsCancellationRequested)
            {
                var json = JsonSerializer.Serialize(Snapshot(dataDir), Compact);
                // Resend an unchanged snapshot only as a keep-alive comment.
                await ctx.Response.WriteAsync(json == last ? ": keep-alive\n\n" : $"data: {json}\n\n", ctx.RequestAborted);
                await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
                last = json;
                try { await Task.Delay(2000, ctx.RequestAborted); } catch (OperationCanceledException) { }
            }
        });

        Log.Info("api", $"dashboard API on http://localhost:{Port} (CORS: {PagesOrigin})");
        return app.RunAsync(ct);
    }

    static async Task<IResult> QueueHumanReply(string dataDir, string sessionId, SessionReplyRequest? request)
    {
        if (!Guid.TryParse(sessionId, out var parsedId))
            return Results.BadRequest(new { error = "Invalid session id." });

        var message = request?.Message?.Trim();
        if (string.IsNullOrWhiteSpace(message))
            return Results.BadRequest(new { error = "Enter a reply before sending." });
        if (message.Length > 10000)
            return Results.BadRequest(new { error = "Replies must be 10,000 characters or fewer." });

        var id = parsedId.ToString("D");
        var sessionPath = Path.Combine(dataDir, "sessions", id + ".json");
        if (!File.Exists(sessionPath)) return Results.NotFound(new { error = "Session not found." });

        var session = Json.Read<SessionFile>(sessionPath);
        if (session is null) return Results.Problem("Session data could not be read.");
        if (session.State == "done") return Results.Conflict(new { error = "This session is already complete." });
        if (session.State != "needs_human" && !(session.Needs?.Any(n => n.Resolver == "human") ?? false))
            return Results.Conflict(new { error = "This session is not waiting for human input." });

        var inboxPath = Path.Combine(dataDir, "inbox", id + ".json");
        var reply = new InboxMessage { From = "user", Prompt = message, CreatedAt = DateTimeOffset.UtcNow.ToString("o") };
        try
        {
            await InboxStore.EnqueueAsync(inboxPath, reply);
            return Results.Accepted(value: new { messageId = reply.Id, status = reply.Status });
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            Log.Error("api", $"could not queue user reply for session {id}", e);
            return Results.Problem("The reply could not be queued.", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    static object Snapshot(string dataDir)
    {
        var sessions = new List<SessionFile>();
        var sessionsDir = Path.Combine(dataDir, "sessions");
        if (Directory.Exists(sessionsDir))
            foreach (var f in Directory.GetFiles(sessionsDir, "*.json"))
                if (Json.Read<SessionFile>(f) is { } s) sessions.Add(s);

        var bridgeDir = Path.Combine(dataDir, "bridge");
        var statePath = Path.Combine(bridgeDir, "state.json");
        var queuePath = Path.Combine(bridgeDir, "human-queue.json");

        return new
        {
            now = DateTimeOffset.UtcNow,
            sessions = sessions.OrderByDescending(s => s.UpdatedAt),
            delegations = (File.Exists(statePath) ? Json.Read<BridgeState>(statePath)?.Delegations : null) ?? new(),
            humanQueue = File.Exists(queuePath) ? Json.Read<JsonElement>(queuePath) : default,
            providers = Providers.Status,
            log = TailLog(Path.Combine(bridgeDir, "bridge.log"), 150),
        };
    }

    static List<string> TailLog(string path, int count)
    {
        if (!File.Exists(path)) return [];
        try
        {
            using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            fs.Seek(Math.Max(0, fs.Length - 64 * 1024), SeekOrigin.Begin);
            using var sr = new StreamReader(fs);
            var lines = sr.ReadToEnd().Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return lines.Skip(Math.Max(0, lines.Length - count)).ToList();
        }
        catch (IOException) { return []; }
    }
}
