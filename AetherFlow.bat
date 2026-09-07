@echo off
title AetherFlow Launcher
cd /d "%~dp0"

if exist "%~dp0AetherFlow.exe" (
    echo Starting AetherFlow...
    start "" "%~dp0AetherFlow.exe"
    exit /b 0
)

if exist "%~dp0src-tauri\target\release\aetherflow.exe" (
    echo Starting AetherFlow (Release)...
    start "" "%~dp0src-tauri\target\release\aetherflow.exe"
    exit /b 0
)

if exist "%~dp0src-tauri\target\debug\aetherflow.exe" (
    echo Starting AetherFlow (Debug)...
    start "" "%~dp0src-tauri\target\debug\aetherflow.exe"
    exit /b 0
)

echo Executable not found. Launching development environment...
npm run tauri:dev
