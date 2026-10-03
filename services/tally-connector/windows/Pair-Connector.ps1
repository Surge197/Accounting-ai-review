#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $env:ProgramData 'AccountingTallyConnector\connector.config.json'),
  [string]$ConnectorPath = (Join-Path $env:ProgramFiles 'AccountingTallyConnector\connector.cjs'),
  [string]$NodePath = (Get-Command node.exe -ErrorAction Stop).Source
)
$ErrorActionPreference = 'Stop'
if ((Get-Service AccountingTallyConnector -ErrorAction SilentlyContinue).Status -eq 'Running') { throw 'Stop the service before pairing' }
$token = Read-Host 'Enter the 10-minute pairing token (hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
try {
  # The token goes through stdin, never command arguments, config, or a log file.
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | & $NodePath $ConnectorPath pair $ConfigPath
  if ($LASTEXITCODE -ne 0) { throw 'Pairing failed. Retry before expiry to recover a lost response. See the runbook if the token has expired.' }
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $token.Dispose() }
