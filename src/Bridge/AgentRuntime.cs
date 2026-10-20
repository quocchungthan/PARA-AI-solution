using GitHub.Copilot;

namespace Bridge;

public interface IAgentRuntime
{
    Task<IAgentSession> CreateAsync(SessionConfig config);
    Task<IAgentSession> ResumeAsync(string id, ResumeSessionConfig config);
}

public interface IAgentSession : IAsyncDisposable
{
    Task<string?> SendAsync(string prompt, TimeSpan timeout);
}

public sealed class CopilotAgentRuntime(CopilotClient client) : IAgentRuntime
{
    public async Task<IAgentSession> CreateAsync(SessionConfig config) =>
        new CopilotAgentSession(await client.CreateSessionAsync(config), config.SessionId);

    public async Task<IAgentSession> ResumeAsync(string id, ResumeSessionConfig config) =>
        new CopilotAgentSession(await client.ResumeSessionAsync(id, config), id);

    sealed class CopilotAgentSession : IAgentSession
    {
        readonly CopilotSession _session;

        public CopilotAgentSession(CopilotSession session, string? id)
        {
            _session = session;
            session.On<SessionEvent>(evt =>
            {
                if (evt is not AssistantMessageEvent)
                    Log.Debug("sdk-event", $"{id} {evt.GetType().Name}");
            });
        }

        public async Task<string?> SendAsync(string prompt, TimeSpan timeout)
        {
            var reply = await _session.SendAndWaitAsync(new MessageOptions { Prompt = prompt }, timeout);
            return (reply?.Data as AssistantMessageData)?.Content;
        }

        public ValueTask DisposeAsync() => _session.DisposeAsync();
    }
}
