namespace Bridge;

public static class AgentProfiles
{
    public static List<string> GetNames(string directory) =>
        Directory.Exists(directory)
            ? Directory.GetFiles(directory, "*.agent.md")
                .Select(path => Path.GetFileName(path)[..^".agent.md".Length])
                .Order(StringComparer.Ordinal)
                .ToList()
            : [];
}
