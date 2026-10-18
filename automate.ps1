param([string]$RailwayUrl = $env:RAILWAY_URL)
if (-not $RailwayUrl) { $RailwayUrl = Read-Host "RailwayUrl" }
$RailwayUrl = $RailwayUrl.TrimEnd('/')
Write-Host ">> Using $RailwayUrl" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "js","public/js" | Out-Null
if (-not (Test-Path "js/urartuhi-docent.js" -PathType Leaf)) {
  throw "Browser widget js/urartuhi-docent.js is missing. Restore it from Git; do not copy the backend into public JavaScript."
}
if (Test-Path "js/urartuhi-docent.js") { Copy-Item "js/urartuhi-docent.js" "public/js/urartuhi-docent.js" -Force }
"window.URARTUHI_BACKEND = `"$RailwayUrl/api/narrate`";" | Set-Content "js/urartuhi-live.js" -Encoding utf8
Copy-Item "js/urartuhi-live.js" "public/js/urartuhi-live.js" -Force
$html = Get-Content "index.html" -Raw
$html = $html -replace '<script>window\.URARTUHI_BACKEND.*?</script>\s*',''
$html = $html -replace '<script src=".*?urartuhi.*?\.js"></script>\s*',''
$inject = "<script>window.URARTUHI_BACKEND = `"$RailwayUrl/api/narrate`";</script>`n<script src=`"./js/urartuhi-docent.js`"></script>`n</body>"
$html = $html -replace '</body>', $inject
Set-Content "index.html" -Value $html -Encoding utf8
Write-Host "Docent URL updated locally. Review git diff, then commit and open a pull request; no changes were pushed." -ForegroundColor Cyan
