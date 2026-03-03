@echo off
setlocal
call "%~dp0test-L1.ps1" %*
exit /b %ERRORLEVEL%
