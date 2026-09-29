# Планировщик офиса продаж — локальный сервер без установки Python/Node.
# Запускается из start-windows.bat. Работает на встроенном PowerShell Windows.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.json'='application/json';
            '.css'='text/css'; '.svg'='image/svg+xml'; '.png'='image/png'; '.txt'='text/plain; charset=utf-8' }
$listener = $null
foreach ($p in 8080..8090) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start(); $listener = $l; $port = $p; break
  } catch { Write-Host "Порт $p занят, пробую следующий..." }
}
if (-not $listener) { Write-Host 'Не удалось открыть порты 8080-8090. Откройте index.html двойным щелчком.'; exit 1 }
$url = "http://localhost:$port/"
Write-Host ''
Write-Host "  Планировщик запущен: $url"
Write-Host '  Не закрывайте это окно, пока работаете. Остановить: Ctrl+C или закрыть окно.'
Write-Host ''
if ($env:OP_NO_BROWSER -ne '1') { try { Start-Process $url } catch { Write-Host "Откройте в браузере: $url" } }
$rootFull = [IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    if ($file.StartsWith($rootFull) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ct = $types[[IO.Path]::GetExtension($file).ToLower()]; if (-not $ct) { $ct = 'application/octet-stream' }
      $ctx.Response.ContentType = $ct
      $ctx.Response.Headers.Add('Cache-Control','no-cache')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { try { $ctx.Response.StatusCode = 500 } catch {} }
  finally { $ctx.Response.Close() }
}
