@echo off
title Push Aadhithan Groups to GitHub
echo ========================================================
echo Pushing Aadhithan Groups Portal to GitHub...
echo Repository: https://github.com/aadhiranrelax/Aadhithan-Groups.git
echo ========================================================
echo.
cd /d "%~dp0"
git push -u origin main
echo.
echo ========================================================
pause
