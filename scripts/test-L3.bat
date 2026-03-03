@echo off
setlocal
call "%~dp0test-L3.ps1" %*
exit /b %ERRORLEVEL%
