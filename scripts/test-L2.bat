@echo off
setlocal
call "%~dp0test-L2.ps1" %*
exit /b %ERRORLEVEL%
