#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$service = Get-Service AccountingTallyConnector -ErrorAction SilentlyContinue
if ($service) {
  if ($service.Status -ne 'Stopped') { Stop-Service AccountingTallyConnector }
  $wrapper = Join-Path $env:ProgramFiles 'AccountingTallyConnector\AccountingTallyConnector.exe'
  & $wrapper uninstall
  if ($LASTEXITCODE -ne 0) { throw 'WinSW service removal failed' }
}
Write-Host 'Service removed. Connector binaries, protected identity, journal, and logs have been preserved. Revoke the agent in the backend if retiring this server.'
