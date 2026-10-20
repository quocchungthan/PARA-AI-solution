using System.Collections.Concurrent;

namespace Bridge;

public static class InboxStore
{
    static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new(StringComparer.OrdinalIgnoreCase);

    public static Task EnqueueAsync(string path, InboxMessage message) =>
        UpdateFileAsync(path, inbox => inbox.Messages.Add(message));

    public static Task EnqueueHumanReplyAsync(string path, InboxMessage message) =>
        UpdateFileAsync(path, inbox =>
        {
            if (inbox.Messages.Any(m => m.From == "user" && m.Status is "pending" or "delivering"))
                throw new InvalidOperationException("A reply is already queued or being delivered for this session.");
            inbox.Messages.Add(message);
        });

    public static Task EnqueueIfAbsentAsync(string path, InboxMessage message) =>
        UpdateFileAsync(path, inbox =>
        {
            if (inbox.Messages.All(m => m.Id != message.Id))
                inbox.Messages.Add(message);
        });

    public static Task UpdateMessageAsync(string path, InboxMessage message) =>
        UpdateFileAsync(path, inbox =>
        {
            var existing = inbox.Messages.FirstOrDefault(m => m.Id == message.Id)
                ?? throw new IOException($"Inbox message {message.Id} no longer exists in {path}.");
            existing.Status = message.Status;
            existing.Response = message.Response;
            existing.DeliveredAt = message.DeliveredAt;
            existing.Attempts = message.Attempts;
            existing.LastAttemptAt = message.LastAttemptAt;
            existing.NextAttemptAt = message.NextAttemptAt;
            existing.LastError = message.LastError;
        });

    static async Task UpdateFileAsync(string path, Action<InboxFile> update)
    {
        var gate = Gates.GetOrAdd(Path.GetFullPath(path), _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            var inbox = File.Exists(path)
                ? Json.Read<InboxFile>(path) ?? throw new IOException($"Inbox file {path} could not be read.")
                : new InboxFile();
            update(inbox);
            Json.WriteAtomic(path, inbox);
        }
        finally { gate.Release(); }
    }
}
