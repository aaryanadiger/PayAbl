[CmdletBinding()]
param(
    [string]$IpaPath = (Join-Path $PSScriptRoot '../build/iphone/PayAbl-unsigned.ipa'),
    [string]$Udid
)

$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $IpaPath -PathType Leaf)) {
    throw "IPA not found: $IpaPath. Download the successful Build iPhone IPA artifact first."
}
$ipaFull = (Resolve-Path -LiteralPath $IpaPath).Path
$routes = (& wsl -d Ubuntu -u root -- ip -j -4 route show default) | ConvertFrom-Json
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
$linuxIpa = (& wsl -d Ubuntu -u root -- wslpath -a -u $ipaFull).Trim()
if ($LASTEXITCODE -ne 0 -or !$linuxIpa.StartsWith('/')) { throw 'Could not convert the IPA path for WSL.' }
Write-Host "Using existing root Apple session and Windows USB relay ${gateway}:27015."
$xtoolArgs = @('-d', 'Ubuntu', '-u', 'root', '--', 'env', "USBMUXD_SOCKET_ADDRESS=${gateway}:27015", 'xtool', 'install', '--usb')
if ($Udid) { $xtoolArgs += @('--udid', $Udid) }
$xtoolArgs += $linuxIpa
& wsl @xtoolArgs
if ($LASTEXITCODE -ne 0) { throw "xtool signing/installation failed (exit $LASTEXITCODE)." }
