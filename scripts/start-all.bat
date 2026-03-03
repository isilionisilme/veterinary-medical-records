@echo off
setlocal

echo [DEPRECATED] Use scripts\dev\bootstrap\start-all.bat
call "%~dp0dev\bootstrap\start-all.bat" %*
exit /b %ERRORLEVEL%
