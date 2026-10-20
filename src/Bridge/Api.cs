using System.Text.Json;

namespace Bridge;

// Local HTTP API for the static dashboard (web/).
public static class Api
{
    public const int Port = 5310;
    const string PagesOrigin = "https://quocchungthan.github.io";
    static readonly JsonSerializerOptions Compact = new(Json.Options) { WriteIndented = false };

    static string _agentsDir = "";
    static string _repoRoot = "";

    public static Task Start(string dataDir, CancellationToken ct, string agentsDir = "", string repoRoot = "")
    {
        _agentsDir = agentsDir;
        _repoRoot = repoRoot;
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
        app.MapGet("/api/sessions/{sessionId}/inspect", (string sessionId) =>
        {
            if (!Guid.TryParse(sessionId, out var g)) return Results.BadRequest(new { error = "Invalid session id." });
            var id = g.ToString("D");
            var path = Path.Combine(dataDir, "sessions", id + ".json");
            var state = File.Exists(path) ? Json.Read<SessionFile>(path)?.State ?? "" : "";
            return Results.Ok(Inspector.Inspect(id, state));
        });
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
            await InboxStore.EnqueueHumanReplyAsync(inboxPath, reply);
            return Results.Accepted(value: new { messageId = reply.Id, status = reply.Status });
        }
        catch (InvalidOperationException e)
        {
            return Results.Conflict(new { error = e.Message });
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            Log.Error("api", $"could not queue user reply for session {id}", e);
            return Results.Problem("The reply could not be queued.", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    static object Snapshot(string dataDir, string? repoRoot = null)
    {
        var sessions = SessionStore.LoadAll(dataDir, repoRoot ?? _repoRoot);

        var bridgeDir = Path.Combine(dataDir, "bridge");
        var statePath = Path.Combine(bridgeDir, "state.json");
        var queuePath = Path.Combine(bridgeDir, "human-queue.json");
        var hasState = File.Exists(statePath);
        var state = hasState ? Json.Read<BridgeState>(statePath) : null;
        var ledger = state ?? new BridgeState();

        return new
        {
            now = DateTimeOffset.UtcNow,
            assignmentProtocol = 2,
            roles = AgentProfiles.GetNames(_agentsDir),
            sessions = sessions.OrderByDescending(s => s.UpdatedAt).Select(s => new
            {
                s.SessionId,
                s.Agent,
                s.Title,
                s.TaskType,
                s.Task,
                s.Phase,
                s.Estimate,
                s.Work,
                s.State,
                s.Needs,
                s.Question,
                s.Attempts,
                s.Progress,
                s.Result,
                s.Handoff,
                s.UpdatedAt,
                registered = !s.Discovered,
                stale = SessionHealth.IsStale(s),
                issues = SessionHealth.Issues(s),
                lastActivityAt = Inspector.LastActivity(s.SessionId),
                silent = Inspector.IsSilent(s.State, Inspector.LastActivity(s.SessionId), DateTimeOffset.UtcNow),
            }),
            delegations = (state?.Delegations ?? new())
                .Select(d => new { d.Key, d.OriginId, d.TargetId, d.WantResult, d.Status, d.CreatedAt, d.Attempts, d.NextAttemptAt, d.LastError })
                .ToList(),
            assignments = (state?.Delegations ?? new())
                .Select(d => new { d.Key, d.Protocol, d.OriginId, d.TargetId, d.Title, d.Mode,
                    d.RootKey, d.ParentKey, d.Points, d.WorkState, d.Status, d.Acceptance, d.DependsOn,
                    d.Writes, d.AccessMode, d.Reads, d.Reports, d.LastError,
                    scheduling = AssignmentPolicy.DescribeScheduling(d, ledger,
                        id => sessions.FirstOrDefault(s => string.Equals(s.SessionId, id, StringComparison.OrdinalIgnoreCase))) })
                .ToList(),
            outboxReceipts = (state?.OutboxReceipts ?? new())
                .Select(r => new { r.SessionId, r.CommandId, r.Status, r.AssignmentId, r.Error })
                .ToList(),
            assignmentError = hasState && state is null ? "The assignment ledger could not be read. Existing work has not been reset." : null,
            humanQueue = File.Exists(queuePath) ? Json.Read<JsonElement?>(queuePath) : null,
            providers = Providers.Status,
            deliveries = Directory.Exists(Path.Combine(dataDir, "inbox"))
                ? Directory.GetFiles(Path.Combine(dataDir, "inbox"), "*.json").SelectMany(path =>
                    (Json.Read<InboxFile>(path)?.Messages ?? new())
                        .Where(m => m.From == "user" || m.Status == "failed")
                        .Select(m => new { sessionId = Path.GetFileNameWithoutExtension(path), messageId = m.Id,
                            m.From, m.Status, m.Attempts, m.NextAttemptAt, m.LastError, m.CreatedAt, m.DeliveredAt }))
                    .ToList()
                : [],
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
