#!/usr/bin/env pwsh
# Quick Development Setup Script for WorkSafety

param(
    [Parameter(Position=0)]
    [ValidateSet('dev', 'prod', 'stop', 'logs')]
    [string]$Command
)

if (-not $Command) {
    Write-Host "Usage: .\dev-start.ps1 [dev|prod|stop|logs]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  dev     - Start backend Docker + frontend dev server (HMR)" -ForegroundColor Green
    Write-Host "  prod    - Start everything via Docker (production)" -ForegroundColor Blue
    Write-Host "  stop    - Stop all containers" -ForegroundColor Red
    Write-Host "  logs    - Show backend logs" -ForegroundColor Cyan
    exit 1
}

$compose = "docker-compose -f infra/docker-compose.yml"

switch ($Command) {
    'dev' {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Starting Backend (Docker)..." -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        & docker-compose -f infra/docker-compose.yml up db redis backend worker -d
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Backend started! Now run in another terminal:" -ForegroundColor Green
        Write-Host ""
        Write-Host "  cd frontend" -ForegroundColor Yellow
        Write-Host "  npm run dev" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Access: http://localhost:3000/worksafety/" -ForegroundColor Cyan
        Write-Host "========================================"  -ForegroundColor Green
        Write-Host ""
    }
    
    'prod' {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Blue
        Write-Host "Starting Full Stack (Docker - Production)" -ForegroundColor Blue
        Write-Host "========================================" -ForegroundColor Blue
        Write-Host ""
        
        & docker-compose -f infra/docker-compose.yml up -d --build
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Blue
        Write-Host "Production stack started!" -ForegroundColor Blue
        Write-Host "Access: http://localhost:3000/worksafety/" -ForegroundColor Cyan
        Write-Host "========================================"  -ForegroundColor Blue
        Write-Host ""
    }
    
    'stop' {
        Write-Host "Stopping all containers..." -ForegroundColor Yellow
        & docker-compose -f infra/docker-compose.yml down
        Write-Host "Done." -ForegroundColor Green
    }
    
    'logs' {
        Write-Host "Backend logs (last 50 lines):" -ForegroundColor Cyan
        Write-Host ""
        & docker-compose -f infra/docker-compose.yml logs backend --tail=50 -f
    }
}
