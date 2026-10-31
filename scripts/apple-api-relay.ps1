# Optional workaround when Windows has internet but WSL's outbound NAT is broken.
# CONNECT tunnels preserve end-to-end TLS; no request bodies or secrets are logged.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$BindAddress,
    [Parameter(Mandatory)][string]$AllowedClient,
    [int]$Port = 27016
)
$ErrorActionPreference = 'Stop'
$null = [System.Net.IPAddress]::Parse($BindAddress)
$null = [System.Net.IPAddress]::Parse($AllowedClient)
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public static class PayAblAppleApiRelay {
    private static string permittedClient;
    public static void Run(string address, int port, string client) {
        permittedClient = client;
        var listener = new TcpListener(IPAddress.Parse(address), port);
        listener.Start();
        Console.WriteLine("Apple API relay ready on " + address + ":" + port);
        while (true) {
            var incoming = listener.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(_ => { try { Tunnel(incoming); } catch (Exception) { incoming.Dispose(); } });
        }
    }
    private static void Tunnel(TcpClient incoming) {
        using (incoming) {
            if (((IPEndPoint)incoming.Client.RemoteEndPoint).Address.ToString() != permittedClient) return;
            incoming.ReceiveTimeout = 15000;
            using (var stream = incoming.GetStream()) {
                var header = new MemoryStream();
                int b;
                while (header.Length < 8192 && (b = stream.ReadByte()) >= 0) {
                    header.WriteByte((byte)b);
                    var bytes = header.GetBuffer();
                    int n = (int)header.Length;
                    if (n >= 4 && bytes[n-4] == 13 && bytes[n-3] == 10 && bytes[n-2] == 13 && bytes[n-1] == 10) break;
                }
                var first = Encoding.ASCII.GetString(header.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None)[0].Split(' ');
                Uri target;
                if (first.Length >= 2 && Uri.TryCreate("https://" + first[1], UriKind.Absolute, out target)) {
                    Console.WriteLine("Tunnel request: " + first[0] + " " + target.Host + ":" + target.Port);
                }
                if (first.Length != 3 || first[0] != "CONNECT" || !Uri.TryCreate("https://" + first[1], UriKind.Absolute, out target)
                    || target.Port != 443 || target.UserInfo.Length != 0
                    || !(target.Host.Equals("apple.com", StringComparison.OrdinalIgnoreCase)
                        || target.Host.EndsWith(".apple.com", StringComparison.OrdinalIgnoreCase)
                        || target.Host.Equals("mac-ani.jkcoxson.com", StringComparison.OrdinalIgnoreCase))) {
                    var denied = Encoding.ASCII.GetBytes("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
                    stream.Write(denied, 0, denied.Length);
                    return;
                }
                using (var outgoing = new TcpClient()) {
                    try {
                        if (!outgoing.ConnectAsync(target.Host, 443).Wait(15000)) return;
                        var ready = Encoding.ASCII.GetBytes("HTTP/1.1 200 Connection Established\r\n\r\n");
                        stream.Write(ready, 0, ready.Length);
                        incoming.ReceiveTimeout = 0;
                        using (var remote = outgoing.GetStream()) {
                            Task.WaitAny(stream.CopyToAsync(remote), remote.CopyToAsync(stream));
                        }
                    } catch (Exception) {
                        // Do not print network requests, authentication headers, or bodies.
                    }
                }
            }
        }
    }
}
'@
[PayAblAppleApiRelay]::Run($BindAddress, $Port, $AllowedClient)
