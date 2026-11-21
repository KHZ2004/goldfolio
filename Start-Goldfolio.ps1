$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$taskNode = Get-Command node -ErrorAction SilentlyContinue
if ($taskNode) { $taskNodePath = $taskNode.Source }
else {
    $taskNodePath = Join-Path $env:LOCALAPPDATA 'GoldfolioRuntime/node.exe'
    if (!(Test-Path -LiteralPath $taskNodePath)) { $taskNodePath = Join-Path $env:LOCALAPPDATA 'ms-playwright-go/1.57.0/node.exe' }
    if (!(Test-Path -LiteralPath $taskNodePath)) { throw 'Install Node.js 22 or newer from https://nodejs.org, then run npm install in this folder.' }
}
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/web-push'))) { throw 'Dependencies are missing. Run npm install first.' }
Write-Host 'Open http://localhost:3000 on this computer. Keep this window running for price updates and alerts.'
& $taskNodePath server.mjs
