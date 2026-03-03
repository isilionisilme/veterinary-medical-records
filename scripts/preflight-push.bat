@echo off
setlocal
call "%~dp0preflight-push.ps1" %*
exit /b %ERRORLEVEL%
