@echo off
setlocal
call "%~dp0preflight-quick.ps1" %*
exit /b %ERRORLEVEL%
