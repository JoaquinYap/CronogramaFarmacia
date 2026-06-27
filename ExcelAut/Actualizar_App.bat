@echo off
title Servidor de CronoExcel
echo ==============================================
echo    INICIANDO SERVIDOR DE ACTUALIZACION
echo ==============================================
echo.
echo 1. Iniciando servidor web local...
start /B python -m http.server 8080

echo 2. Creando el tunel seguro...
echo.
echo IMPORTANTE: Manten esta ventana negra abierta.
echo Cuando veas un mensaje que dice "your url is: https://...",
echo copia ese enlace, abrilo en el navegador de tu celular y dale a actualizar.
echo.
echo Para apagar el servidor, simplemente cerra esta ventana.
echo.
call npx -y localtunnel --port 8080
pause
