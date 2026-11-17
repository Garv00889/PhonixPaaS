@echo off
:: ==============================================================================
:: PhonixPaaS - Windows Hosts Setup
:: Maps phone server IP to http://phonixpaas.local:4000
:: Run this file as Administrator (Right click -> Run as Administrator)
:: ==============================================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please right-click this file and select 'Run as Administrator'.
    pause
    exit /b 1
)

set PHONE_IP=192.168.29.182
set HOSTS_FILE=%SystemRoot%\System32\drivers\etc\hosts

findstr /i "phonixpaas.local" "%HOSTS_FILE%" >nul
if %errorLevel% equ 0 (
    echo [INFO] PhonixPaaS host entries already exist in %HOSTS_FILE%.
) else (
    echo. >> "%HOSTS_FILE%"
    echo %PHONE_IP%    phonixpaas.local phonix.local phonixpaas.io >> "%HOSTS_FILE%"
    echo [SUCCESS] Added %PHONE_IP% -> phonixpaas.local to %HOSTS_FILE%!
)

echo.
echo ==========================================================
echo  PhonixPaaS is now accessible at:
echo  http://phonixpaas.local:4000
echo  http://phonixpaas.io:4000
echo ==========================================================
echo.
pause
