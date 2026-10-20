using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace Bridge;

// File.Move(..., overwrite:true) preserves the existing state if replacement fails.
// Never fall back to truncating/copying over the ledger. This small retry is exclusively
// filesystem contention handling, not permission-policy or agent/tool approval handling.
public static class AssignmentPersistence
{
    public static void Replace(string source, string destination, Action<string, string>? move = null,
        Action<TimeSpan>? delay = null, Func<string, string, bool>? accessContention = null)
    {
        move ??= (from, to) => File.Move(from, to, overwrite: true);
        delay ??= Thread.Sleep;
        accessContention ??= HasReplaceAccessOrSharingConflict;
        for (var attempt = 0; ; attempt++)
        {
            try { move(source, destination); return; }
            catch (Exception error) when (attempt < 2 && IsContention(error, source, destination, accessContention))
            {
                delay(TimeSpan.FromMilliseconds(attempt == 0 ? 25 : 75));
            }
        }
    }

    static bool IsContention(Exception error, string source, string destination,
        Func<string, string, bool> accessContention)
    {
        if (error is not (IOException or UnauthorizedAccessException)) return false;
        // Only HRESULT_FROM_WIN32, never an arbitrary exception with matching low bits.
        var code = unchecked((uint)error.HResult);
        return code is 0x80070020 or 0x80070021 ||
            code == 0x80070005 && accessContention(source, destination);
    }

    static bool HasReplaceAccessOrSharingConflict(string source, string destination)
    {
        if (!OperatingSystem.IsWindows() || !File.Exists(source) || !File.Exists(destination)) return false;
        try
        {
            var attributes = File.GetAttributes(destination);
            if ((attributes & (FileAttributes.ReadOnly | FileAttributes.Directory | FileAttributes.Hidden | FileAttributes.System)) != 0)
                return false;
            // Opening for DELETE access WITHOUT DeleteOnClose does not delete or change a file.
            // A denied ACL yields ERROR_ACCESS_DENIED and is not retried. A successful probe or
            // sharing conflict on BOTH rename operands supports transient replacement contention.
            var directory = Path.GetDirectoryName(Path.GetFullPath(destination))!;
            using var parent = CreateFile(directory, 2 /* FILE_ADD_FILE */, 7, IntPtr.Zero,
                3, 0x02000000 /* directory handle, no mutations */, IntPtr.Zero);
            if (parent.IsInvalid && Marshal.GetLastWin32Error() is not (32 or 33)) return false;
            return DeleteAccessOrSharing(source) && DeleteAccessOrSharing(destination);
        }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
    }

    static bool DeleteAccessOrSharing(string path)
    {
        using var handle = CreateFile(path, 0x00010000 /* DELETE */, 7 /* share read/write/delete */,
            IntPtr.Zero, 3 /* OPEN_EXISTING */, 0x80 /* normal, no DeleteOnClose */, IntPtr.Zero);
        if (!handle.IsInvalid) return true;
        return Marshal.GetLastWin32Error() is 32 or 33;
    }

    [DllImport("kernel32.dll", EntryPoint = "CreateFileW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string path, uint access, uint share, IntPtr security,
        uint creation, uint flags, IntPtr template);
}
