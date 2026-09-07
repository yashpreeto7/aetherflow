@echo off
title AetherFlow Launcher
cd /d "%~dp0"

:: Check if standalone AetherFlow.exe exists
if exist "%~dp0AetherFlow.exe" (
    echo Starting AetherFlow...
    start "" "%~dp0AetherFlow.exe"
    exit /b 0
)

:: Check if release build exists in target folder
if exist "%~dp0src-tauri\target\release\aetherflow.exe" (
    echo Starting AetherFlow (Release)...
    start "" "%~dp0src-tauri\target\release\aetherflow.exe"
    exit /b 0
)

:: Check if debug build exists in target folder
if exist "%~dp0src-tauri\target\debug\aetherflow.exe" (
    echo Starting AetherFlow (Debug)...
    start "" "%~dp0src-tauri\target\debug\aetherflow.exe"
    exit /b 0
)

:: If executable not found, fallback to tauri:dev
echo Executable not found. Launching development environment...
npm run tauri:dev
