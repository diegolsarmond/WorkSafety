# Script to clear cache and restart the development server
Write-Host "Clearing caches and restarting WorkSafety frontend..." -ForegroundColor Cyan

# Kill any running node processes on port 3000
$processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($processes) {
    $processes | ForEach-Object { 
        try {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process PID: $_" -ForegroundColor Yellow
        } catch {}
    }
}

# Clear npm cache
Write-Host "Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>$null | Out-Null

# Remove node_modules/.cache if exists
$cachePath = ".\.vite"
if (Test-Path $cachePath) {
    Remove-Item -Path $cachePath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleared .vite cache" -ForegroundColor Yellow
}

# Clear dist folder
if (Test-Path ".\dist") {
    Remove-Item -Path ".\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleared dist folder" -ForegroundColor Yellow
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path ".\node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting development server..." -ForegroundColor Green
npm run dev
