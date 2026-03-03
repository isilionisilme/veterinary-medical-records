@echo off
setlocal

echo [DEPRECATED] Use scripts\dev\local-env\reload-vscode-window.bat
call "%~dp0dev\local-env\reload-vscode-window.bat" %*
exit /b %ERRORLEVEL%
