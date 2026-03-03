@echo off
setlocal

echo [DEPRECATED] Use scripts\dev\local-env\reset-dev-db.bat
call "%~dp0dev\local-env\reset-dev-db.bat" %*
exit /b %ERRORLEVEL%
