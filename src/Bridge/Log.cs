namespace Bridge;

// Console + data/bridge/bridge.log (append). Format: "2026-10-14T10:00:00.000 INFO  [component] message key=value".
public static class Log
{
    static string? _file;
    static readonly object Gate = new();

    public static void Init(string path) { _file = path; Directory.CreateDirectory(Path.GetDirectoryName(path)!); }

    public static void Debug(string c, string m) => Write("DEBUG", c, m);
    public static void Info(string c, string m) => Write("INFO ", c, m);
    public static void Warn(string c, string m) => Write("WARN ", c, m);
    public static void Error(string c, string m, Exception? e = null) => Write("ERROR", c, e is null ? m : $"{m} | {e.GetType().Name}: {e.Message}\n{e.StackTrace}");

    static void Write(string level, string c, string m)
    {
        var line = $"{DateTime.Now:yyyy-MM-ddTHH:mm:ss.fff} {level} [{c}] {m}";
        lock (Gate)
        {
            var prev = Console.ForegroundColor;
            Console.ForegroundColor = level.Trim() switch { "ERROR" => ConsoleColor.Red, "WARN" => ConsoleColor.Yellow, "DEBUG" => ConsoleColor.DarkGray, _ => prev };
            Console.WriteLine(line);
            Console.ForegroundColor = prev;
            if (_file is not null) try { File.AppendAllText(_file, line + Environment.NewLine); } catch (IOException) { }
        }
    }

    public static string Short(string? s, int n = 120) => s is null ? "" : s.Length <= n ? s.Replace('\n', ' ') : s[..n].Replace('\n', ' ') + "...";
}
