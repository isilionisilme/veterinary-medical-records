@echo off
setlocal

echo [DEPRECATED] Use scripts\dev\local-env\clear-documents.bat
call "%~dp0dev\local-env\clear-documents.bat" %*
exit /b %ERRORLEVEL%
