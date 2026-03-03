@echo off
setlocal
call "%~dp0preflight-full.ps1" %*
exit /b %ERRORLEVEL%
