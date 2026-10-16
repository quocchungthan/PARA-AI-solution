using System.Diagnostics;
using System.Globalization;

namespace Bridge;

// Single source of truth for "which sessions exist". Agents register themselves in data/sessions, but a
// session that never did (hook not loaded, started before the hook, agent ignored the protocol) must still
// be visible, so every Copilot session whose cwd is inside this repo is discovered from Copilot's own
// session-state and merged in as an unregistered, read-only entry. Nothing is ever written to data/sessions.
public static class SessionStore
{
    static readonly TimeSpan RecentWindow = TimeSpan.FromDays(7);

    static readonly string StateRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".copilot", "session-state");

    public static List<SessionFile> LoadAll(string dataDir, string repoRoot)
    {
        var sessions = new List<SessionFile>();
        var known = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var dir = Path.Combine(dataDir, "sessions");
        if (Directory.Exists(dir))
            foreach (var f in Directory.GetFiles(dir, "*.json"))
            {
                // Known even when unreadable: a half-written file must not appear as a second, discovered copy.
                known.Add(Path.GetFileNameWithoutExtension(f));
                if (Json.Read<SessionFile>(f) is { SessionId.Length: > 0 } s) sessions.Add(s);
            }

        sessions.AddRange(Discover(repoRoot, known));
        return sessions;
    }

    static List<SessionFile> Discover(string repoRoot, HashSet<string> known)
    {
        var found = new List<SessionFile>();
        if (!Directory.Exists(StateRoot)) return found;
        var root = Normalize(repoRoot);
        var now = DateTimeOffset.UtcNow;

        foreach (var dir in Directory.EnumerateDirectories(StateRoot))
        {
            var id = Path.GetFileName(dir);
            if (known.Contains(id) || !Guid.TryParse(id, out _)) continue;
            try
            {
                var yaml = Path.Combine(dir, "workspace.yaml");
                if (!File.Exists(yaml)) continue;
                var meta = ReadYaml(yaml);
                var cwd = meta.GetValueOrDefault("cwd") ?? meta.GetValueOrDefault("git_root");
                if (cwd is null || !IsInside(Normalize(cwd), root)) continue;

                var live = IsLive(dir);
                var activity = Inspector.LastActivity(id) ?? Stamp(meta.GetValueOrDefault("updated_at")) ?? Stamp(meta.GetValueOrDefault("created_at"));
                if (!live && (activity is null || now - activity > RecentWindow)) continue;

                var name = meta.GetValueOrDefault("name");
                found.Add(new SessionFile
                {
                    SessionId = id,
                    Agent = "unknown",
                    Title = string.IsNullOrWhiteSpace(name) ? "(unregistered session)" : name,
                    Task = "Discovered from Copilot session-state; the agent never wrote data/sessions/" + id + ".json.",
                    State = live ? "working" : "done",
                    UpdatedAt = activity?.ToString("o"),
                    Discovered = true,
                });
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
                Log.Debug("discover", $"skipping {id}: {e.Message}");
            }
        }
        return found;
    }

    // Copilot holds inuse.<pid>.lock for as long as a process owns the session.
    static bool IsLive(string dir)
    {
        foreach (var lck in Directory.EnumerateFiles(dir, "inuse.*.lock"))
        {
            var parts = Path.GetFileName(lck).Split('.');
            if (parts.Length == 3 && int.TryParse(parts[1], out var pid))
            {
                try { using var p = Process.GetProcessById(pid); if (!p.HasExited) return true; }
                catch (ArgumentException) { }
                catch (InvalidOperationException) { }
            }
        }
        return false;
    }

    static Dictionary<string, string> ReadYaml(string path)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var line in File.ReadLines(path))
        {
            var i = line.IndexOf(':');
            if (i <= 0 || char.IsWhiteSpace(line[0])) continue;
            map[line[..i].Trim()] = line[(i + 1)..].Trim().Trim('"', '\'');
        }
        return map;
    }

    static DateTimeOffset? Stamp(string? s) =>
        DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d) ? d : null;

    static string Normalize(string p) => Path.GetFullPath(p).TrimEnd('\\', '/');

    static bool IsInside(string path, string root) =>
        path.Equals(root, StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
}
