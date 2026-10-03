#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$ConfigPath,
  [Parameter(Mandatory)][string]$WinSwPath,
  [Parameter(Mandatory)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$WinSwSha256,
  [string]$PackagePath = (Split-Path $PSScriptRoot -Parent),
  [string]$NodePath = (Get-Command node.exe -ErrorAction Stop).Source
)
$ErrorActionPreference = 'Stop'
if (Get-Service AccountingTallyConnector -ErrorAction SilentlyContinue) { throw 'Service exists. Stop and uninstall it before reinstalling; its identity and logs will be preserved.' }
$packageRoot = (Resolve-Path -LiteralPath $PackagePath).Path
$wrapper = (Resolve-Path -LiteralPath $WinSwPath).Path
$nodeExe = (Resolve-Path -LiteralPath $NodePath).Path
if ((Get-FileHash -LiteralPath $wrapper -Algorithm SHA256).Hash -ne $WinSwSha256) { throw 'WinSW checksum mismatch' }
if ((& $nodeExe --version) -notmatch '^v24\.') { throw 'Install Node.js 24 LTS first' }
if (!(Test-Path -LiteralPath (Join-Path $packageRoot 'connector.cjs'))) { throw 'Build the connector bundle first' }
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($config.backendUrl -notmatch '^https://' -or $config.allowInsecureLoopback) { throw 'Installed services require an HTTPS backend with development bypass disabled' }
if ($config.adapter -notin @('mock','local')) { throw 'An explicit adapter is required' }
$installDir = Join-Path $env:ProgramFiles 'AccountingTallyConnector'
$stateRoot = Join-Path $env:ProgramData 'AccountingTallyConnector'
$dataDir = Join-Path $stateRoot 'data'
function Set-ConnectorAcl([string]$Target, [string]$ServiceRights) {
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($entry in @(@('S-1-5-18','FullControl'), @('S-1-5-32-544','FullControl'), @('S-1-5-19',$ServiceRights))) {
    $sid = New-Object Security.Principal.SecurityIdentifier($entry[0])
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, $entry[1], 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Target -AclObject $acl
}
foreach ($dir in @($installDir, $stateRoot, $dataDir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-ConnectorAcl $installDir 'ReadAndExecute'
Set-ConnectorAcl $stateRoot 'ReadAndExecute'
Set-ConnectorAcl $dataDir 'Modify'
Copy-Item -LiteralPath (Join-Path $packageRoot 'connector.cjs') -Destination (Join-Path $installDir 'connector.cjs')
foreach ($file in @('README.md','NOTICE.txt','THIRD-PARTY-LICENSES.txt')) { Copy-Item -LiteralPath (Join-Path $packageRoot $file) -Destination (Join-Path $installDir $file) }
Copy-Item -LiteralPath $wrapper -Destination (Join-Path $installDir 'AccountingTallyConnector.exe')
foreach ($file in @('Pair-Connector.ps1','Uninstall-Connector.ps1')) { Copy-Item -LiteralPath (Join-Path $packageRoot "windows\$file") -Destination (Join-Path $installDir $file) }
$config | Add-Member -NotePropertyName dataDir -NotePropertyValue $dataDir -Force
$configFile = Join-Path $stateRoot 'connector.config.json'
$config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configFile -Encoding UTF8
# Validate the complete config with a harmless metadata probe before creating the service.
& $nodeExe (Join-Path $installDir 'connector.cjs') inspect $configFile
if ($LASTEXITCODE -ne 0) { throw 'Connector configuration validation failed' }
$xmlNode = [Security.SecurityElement]::Escape($nodeExe)
$xmlConfig = [Security.SecurityElement]::Escape($configFile)
$xmlDir = [Security.SecurityElement]::Escape($installDir)
$xmlLog = [Security.SecurityElement]::Escape((Join-Path $dataDir 'logs'))
$xml = @"
<service>
  <id>AccountingTallyConnector</id>
  <name>Accounting Tally Connector</name>
  <description>Outbound accounting connector. No inbound listener. Adapter: $($config.adapter).</description>
  <executable>$xmlNode</executable>
  <arguments>&quot;$xmlDir\connector.cjs&quot; run &quot;$xmlConfig&quot;</arguments>
  <workingdirectory>$xmlDir</workingdirectory>
  <env name="NODE_ENV" value="production" />
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
  <onfailure action="restart" delay="10 sec" />
  <onfailure action="restart" delay="30 sec" />
  <onfailure action="restart" delay="60 sec" />
  <stoptimeout>20 sec</stoptimeout>
  <logpath>$xmlLog</logpath>
  <log mode="roll-by-size"><sizeThreshold>1024</sizeThreshold><keepFiles>4</keepFiles></log>
</service>
"@
$xml | Set-Content -LiteralPath (Join-Path $installDir 'AccountingTallyConnector.xml') -Encoding UTF8
& (Join-Path $installDir 'AccountingTallyConnector.exe') install
if ($LASTEXITCODE -ne 0) { throw 'WinSW service installation failed' }
Write-Host 'Installed with automatic delayed start under LocalService. Pair using Pair-Connector.ps1, then Start-Service AccountingTallyConnector.'
