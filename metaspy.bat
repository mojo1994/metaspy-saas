@echo off
title MetaSpy - Servidor + SaaS
cd /d "%~dp0"

echo ========================================
echo        MetaSpy - Iniciando...
echo ========================================
echo.

:: Inicia o backend (porta 3001)
echo [1/3] Iniciando servidor backend...
start "MetaSpy Server" cmd /c "cd /d "%~dp0server" && node index.js"
if %errorlevel% neq 0 (
    echo ERRO ao iniciar servidor!
    pause
    exit /b 1
)

:: Aguarda o backend subir
timeout /t 2 /nobreak >nul

:: Inicia o frontend Vite (porta 5173)
echo [2/3] Iniciando frontend SaaS...
start "MetaSpy Vite" cmd /c "cd /d "%~dp0" && npx vite"

:: Aguarda o frontend subir
timeout /t 3 /nobreak >nul

:: Abre o navegador
echo [3/3] Abrindo navegador...
start http://localhost:5173

echo.
echo ========================================
echo  MetaSpy rodando!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:3001
echo ========================================
echo.
echo  Feche esta janela para encerrar tudo.
pause
