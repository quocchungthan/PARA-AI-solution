namespace Bridge;

public sealed class BridgeLease : IDisposable
{
    readonly FileStream _file;

    public BridgeLease(string dataDir)
    {
        var dir = Path.Combine(dataDir, "bridge");
        Directory.CreateDirectory(dir);
        try
        {
            _file = new FileStream(Path.Combine(dir, "writer.lock"), FileMode.OpenOrCreate,
                FileAccess.ReadWrite, FileShare.None);
        }
        catch (IOException e)
        {
            throw new IOException($"Cannot acquire the Bridge writer lock in {dir}. Another Bridge may be running; no scan was started.", e);
        }
    }

    public void Dispose() => _file.Dispose();
}
