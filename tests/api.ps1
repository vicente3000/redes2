param([string]$Base='http://127.0.0.1:5080',[Parameter(Mandatory)][string]$Password,[int]$StaleTimeoutSeconds=0)
$ErrorActionPreference='Stop'
function Check($Method,$Path,$Expected,$Body,$Session) {
  $arguments=@{Uri="$Base$Path";Method=$Method;SkipHttpErrorCheck=$true}
  if($null -ne $Body){$arguments.Body=$Body | ConvertTo-Json -Compress; $arguments.ContentType='application/json'}
  if($Session){$arguments.WebSession=$Session}
  $r=Invoke-WebRequest @arguments
  if($r.StatusCode -ne $Expected){throw "$Method ${Path}: esperado $Expected, recibido $($r.StatusCode) $($r.Content)"}
  if($r.Content -is [byte[]]){return [Text.Encoding]::UTF8.GetString($r.Content) | ConvertFrom-Json}
  if($r.Content){return $r.Content | ConvertFrom-Json}
}
$session=[Microsoft.PowerShell.Commands.WebRequestSession]::new()
$null=Check GET '/api/health' 200
$null=Check POST '/api/alarm/activate' 401 @{} $session
$null=Check POST '/api/sensors' 400 @{temperature=22;humidity=101;light=100;gas=200;source='simulator'}
$null=Check POST '/api/sensors' 201 @{temperature=22;humidity=50;light=100;gas=3500;source='simulator'}
$latest=Check GET '/api/sensors/latest?source=simulator' 200
if($latest.reading.gas -ne 3500 -or !$latest.gasWarning -or $latest.stale){throw 'Telemetría inesperada'}
if((Check GET '/api/alarm?source=simulator' 200).active){throw 'El gas activó la alarma'}
if(!(Check GET '/api/sensors/history?source=simulator' 200).readings.Count){throw 'Historial vacío'}
$null=Check POST '/api/auth/login' 401 @{username='admin';password='incorrecta'} $session
$null=Check POST '/api/auth/login' 200 @{username='admin';password=$Password} $session
$null=Check POST '/api/alarm/activate?source=simulator' 200 @{} $session
if(!(Check GET '/api/alarm?source=simulator' 200).active){throw 'Activación ausente'}
if((Check GET '/api/alarm?source=device' 200).active){throw 'Activación cruzada'}
$null=Check POST '/api/alarm/deactivate?source=simulator' 200 @{} $session
if((Check GET '/api/alarm?source=simulator' 200).active){throw 'Desactivación ausente'}
if((Check GET '/api/alarm/events?source=simulator' 200 $null $session).events.Count -lt 2){throw 'Auditoría incompleta'}
$null=Check POST '/api/auth/logout' 204 @{} $session
$null=Check POST '/api/alarm/deactivate' 401 @{} $session
if($StaleTimeoutSeconds -gt 0){
  $deadline=(Get-Date).AddSeconds($StaleTimeoutSeconds)
  do {
    Start-Sleep -Seconds 1
    $latest=Check GET '/api/sensors/latest?source=simulator' 200
  } until($latest.stale -or (Get-Date) -ge $deadline)
  if(!$latest.stale){throw 'La lectura no fue marcada desactualizada'}
  $null=Check POST '/api/sensors' 201 @{temperature=$null;humidity=$null;light=120;gas=200;source='simulator'}
  if((Check GET '/api/sensors/latest?source=simulator' 200).stale){throw 'La fuente no recuperó frescura'}
}
'Integración API aprobada'
