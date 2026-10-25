@echo off
title Push Aadhithan Groups to GitHub
echo ========================================================
echo   Aadhithan Groups - Push to GitHub
echo   Repository: https://github.com/aadhiranrelax/Aadhithan-Groups.git
echo   Branch: main
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/4] Checking changed files...
git status --short
echo.

set /p msg="Enter commit message (Press Enter for automatic timestamp): "
if "%msg%"=="" (
    set msg=Update Aadhithan Groups: %date% %time%
)

echo.
echo [2/4] Staging files...
git add -A

echo.
echo [3/4] Committing changes...
git commit -m "%msg%"

echo.
echo [4/4] Pushing to GitHub...
git push -u origin main

echo.
echo ========================================================
if %errorlevel% equ 0 (
    echo Sync complete! All changes are live on GitHub.
) else (
    echo Push failed. If this is your first time, check your GitHub login.
)
echo ========================================================
pause
