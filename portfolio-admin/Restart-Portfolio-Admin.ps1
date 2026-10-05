$ErrorActionPreference = 'Stop'
$expectedServer = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'server.cjs'))
$processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
foreach ($dashboardProcess in $processes) {
    if ($dashboardProcess.CommandLine -and $dashboardProcess.CommandLine.Contains('"' + $expectedServer + '"')) {
        Stop-Process -Id $dashboardProcess.ProcessId -Force
    }
}
& (Join-Path $PSScriptRoot 'Start-Portfolio-Admin.ps1')
