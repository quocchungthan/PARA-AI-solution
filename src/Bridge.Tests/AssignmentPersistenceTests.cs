using Bridge;
using Xunit;

namespace Bridge.Tests;

public class AssignmentPersistenceTests
{
    [Theory]
    [InlineData(32)]
    [InlineData(33)]
    public void SharingFailuresRetryTwiceWithoutNonAtomicFallback(int code)
    {
        var attempts = 0;
        var delays = new List<TimeSpan>();
        AssignmentPersistence.Replace("source", "target", (_, _) =>
        {
            if (++attempts < 3) throw new IOException("sharing", unchecked((int)(0x80070000u + (uint)code)));
        }, delays.Add);
        Assert.Equal(3, attempts);
        Assert.Equal(new[] { TimeSpan.FromMilliseconds(25), TimeSpan.FromMilliseconds(75) }, delays);
    }

    [Fact]
    public void AccessDeniedOnlyRetriesWithPositiveContentionCheck()
    {
        var attempts = 0;
        Assert.Throws<UnauthorizedAccessException>(() => AssignmentPersistence.Replace("source", "target",
            (_, _) => { attempts++; throw new UnauthorizedAccessException("ACL denied"); }, _ => { }, (_, _) => false));
        Assert.Equal(1, attempts);
        attempts = 0;
        AssignmentPersistence.Replace("source", "target", (_, _) =>
        {
            if (++attempts < 3) throw new UnauthorizedAccessException("Verified transient contention");
        }, _ => { }, (_, _) => true);
        Assert.Equal(3, attempts);
        attempts = 0;
        Assert.Throws<IOException>(() => AssignmentPersistence.Replace("source", "target",
            (_, _) => { attempts++; throw new IOException("disk full", unchecked((int)0x80070070)); }, _ => { }));
        Assert.Equal(1, attempts);
    }

    [Fact]
    public void ExhaustedReplacementPreservesOldStateAndCleansTemporaryFile()
    {
        var directory = Path.Combine(Path.GetTempPath(), "para-assignment-write", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "state.json");
        try
        {
            Json.WriteAtomic(path, new { version = "old" });
            var old = File.ReadAllText(path);
            var attempts = 0;
            Assert.Throws<IOException>(() => Json.WriteAtomic(path, new { version = "new" }, (_, _) =>
            {
                attempts++;
                throw new IOException("sharing", unchecked((int)0x80070020));
            }));
            Assert.Equal(3, attempts);
            Assert.Equal(old, File.ReadAllText(path));
            Assert.Single(Directory.GetFiles(directory));
            Json.WriteAtomic(path, new { version = "new" });
            Assert.Contains("new", File.ReadAllText(path));
        }
        finally { Directory.Delete(directory, true); }
    }

    [Fact]
    public void RealWindowsSharingContentionRecoversWithAtomicReplacement()
    {
        if (!OperatingSystem.IsWindows()) return;
        var directory = Path.Combine(Path.GetTempPath(), "para-assignment-sharing", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var source = Path.Combine(directory, "state.tmp");
        var target = Path.Combine(directory, "state.json");
        File.WriteAllText(source, "new state");
        File.WriteAllText(target, "old state");
        FileStream? reader = new(target, FileMode.Open, FileAccess.Read, FileShare.Read);
        try
        {
            var retries = 0;
            AssignmentPersistence.Replace(source, target, delay: _ =>
            {
                Assert.Equal("old state", File.ReadAllText(target));
                retries++;
                reader.Dispose();
                reader = null;
            });
            Assert.Equal(1, retries);
            Assert.Equal("new state", File.ReadAllText(target));
            Assert.False(File.Exists(source));
        }
        finally { reader?.Dispose(); Directory.Delete(directory, true); }
    }
}
