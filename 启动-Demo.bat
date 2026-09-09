@echo off
chcp 65001 >nul
title AI Demo Hub 本地启动
cd /d "%~dp0"

echo ============================================
echo   AI Demo Hub · 接线机器人+电销工作台
echo ============================================
echo.

docker --version >nul 2>&1
if errorlevel 1 (
  echo [未检测到 Docker] 请先安装并启动 Docker Desktop：https://www.docker.com/products/docker-desktop/
  echo 安装后重新双击本脚本即可。
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker 尚未就绪，正在尝试启动 Docker Desktop，请稍候...
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  )
  :waitdocker
  timeout /t 3 >nul
  docker info >nul 2>&1
  if errorlevel 1 (
    echo   仍在等待 Docker 引擎启动...
    goto waitdocker
  )
)

echo [1/3] 构建并启动容器（首次约需 3-8 分钟，之后启动很快）...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo 启动失败，请把本窗口的报错内容截图发我。
  pause
  exit /b 1
)

echo [2/3] 等待后端就绪...
set /a n=0
:waitapi
timeout /t 3 >nul
for /f %%i in ('docker inspect -f "{{.State.Health.Status}}" aihub-api 2^>nul') do set H=%%i
if "%H%"=="healthy" goto ready
set /a n+=1
if %n% geq 30 goto ready
echo   后端启动中... (%n%)
goto waitapi

:ready
echo [3/3] 打开浏览器...
timeout /t 2 >nul
start "" http://localhost:8080

echo.
echo ============================================
echo  已启动：http://localhost:8080
echo  演示账号：admin / Aihub@123456
echo  关闭服务请双击「停止-Demo.bat」
echo ============================================
timeout /t 8 >nul
