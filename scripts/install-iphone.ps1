[CmdletBinding()]
param(
    [string]$IpaPath = (Join-Path $PSScriptRoot '../build/iphone/PayAbl-unsigned.ipa'),
    [string]$Udid,
    [string]$AppleApiProxy,
    [switch]$UseWindowsAppleApiRelay
)

$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $IpaPath -PathType Leaf)) {
    throw "IPA not found: $IpaPath. Download the successful Build iPhone IPA artifact first."
}
$ipaFull = (Resolve-Path -LiteralPath $IpaPath).Path
$routes = (& wsl -d Ubuntu -u root --exec ip -j -4 route show default) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Could not read the current WSL gateway.' }
$gateway = @($routes)[0].gateway
$address = $null
if (![System.Net.IPAddress]::TryParse($gateway, [ref]$address)) { throw 'No valid WSL gateway found.' }
$usbState = (& usbipd list) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Could not check USBIPD device state.' }
if ($usbState -match '(?im)^.*Apple.*\bAttached\b') {
    throw 'The iPhone is attached to USBIPD. Detach it so Apple Mobile Device Service can use it.'
}
$service = Get-Service -Name 'Apple Mobile Device Service'
if ($service.Status -ne 'Running') { throw 'Start Apple Mobile Device Service, then retry.' }
$client = [System.Net.Sockets.TcpClient]::new()
try {
    $connection = $client.ConnectAsync($gateway, 27015)
    if (!$connection.Wait(3000) -or !$client.Connected) {
        throw "The Apple USB relay at ${gateway}:27015 is unavailable. Check its gateway binding and scoped firewall rule."
    }
} finally { $client.Dispose() }
$linuxPathOutput = & wsl -d Ubuntu -u root --exec wslpath -a -u $ipaFull.Replace('\', '/')
if ($LASTEXITCODE -ne 0 -or !$linuxPathOutput) { throw 'Could not convert the IPA path for WSL.' }
$linuxIpa = ($linuxPathOutput -join "`n").Trim()
if (!$linuxIpa.StartsWith('/')) { throw 'Could not convert the IPA path for WSL.' }
Write-Host "Using existing root Apple session and Windows USB relay ${gateway}:27015."
$xtoolArgs = @('-d', 'Ubuntu', '-u', 'root', '--exec', 'env', "USBMUXD_SOCKET_ADDRESS=${gateway}:27015", 'xtool', 'install', '--usb')
if ($AppleApiProxy) {
    $proxyUri = [Uri]::new("http://$AppleApiProxy")
    if ($proxyUri.UserInfo -or $proxyUri.Port -lt 1 -or $proxyUri.Host -ne $gateway) {
        throw 'The optional Apple API proxy must use the current WSL gateway, with no embedded credentials.'
    }
    $xtoolArgs = @('-d', 'Ubuntu', '-u', 'root', '--exec', 'env', "USBMUXD_SOCKET_ADDRESS=${gateway}:27015", "XTL_HTTP_PROXY=$AppleApiProxy", 'xtool', 'install', '--usb')
}
if ($Udid) { $xtoolArgs += @('--udid', $Udid) }
$xtoolArgs += $linuxIpa
$ownedRelay = $null
try {
    if ($UseWindowsAppleApiRelay) {
        if ($AppleApiProxy) { throw 'Choose either UseWindowsAppleApiRelay or an existing AppleApiProxy.' }
        $interfaces = (& wsl -d Ubuntu -u root --exec ip -j -4 addr show dev eth0) | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'Could not read the WSL client address.' }
        $clientAddress = (@($interfaces)[0].addr_info | Where-Object { $_.scope -eq 'global' } | Select-Object -First 1).local
        $parsedClient = $null
        if (![System.Net.IPAddress]::TryParse($clientAddress, [ref]$parsedClient)) { throw 'No valid WSL client address found.' }
        $relayScript = Join-Path $PSScriptRoot 'apple-api-relay.ps1'
        $ownedRelay = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList @(
            '-NoProfile', '-NonInteractive', '-File', ('"' + $relayScript + '"'),
            '-BindAddress', $gateway, '-AllowedClient', $clientAddress
        ) -WindowStyle Hidden -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if ($ownedRelay.HasExited) { throw 'The temporary Apple authentication relay could not start. Port 27016 may already be in use.' }
            $probeClient = [System.Net.Sockets.TcpClient]::new()
            try { $ready = $probeClient.ConnectAsync($gateway, 27016).Wait(250) -and $probeClient.Connected }
            catch { $ready = $false }
            finally { $probeClient.Dispose() }
            if ($ready) { break }
            Start-Sleep -Milliseconds 250
        }
        if (!$ready) { throw 'The temporary Apple authentication relay is unreachable from the WSL interface.' }
        $xtoolArgs = @('-d', 'Ubuntu', '-u', 'root', '--exec', 'env', "USBMUXD_SOCKET_ADDRESS=${gateway}:27015", "XTL_HTTP_PROXY=${gateway}:27016", 'xtool', 'install', '--usb')
        if ($Udid) { $xtoolArgs += @('--udid', $Udid) }
        $xtoolArgs += $linuxIpa
    }
    & wsl @xtoolArgs
    if ($LASTEXITCODE -ne 0) { throw "xtool signing/installation failed (exit $LASTEXITCODE)." }
} finally {
    if ($ownedRelay -and !$ownedRelay.HasExited) { $ownedRelay.Kill(); $ownedRelay.WaitForExit() }
}
