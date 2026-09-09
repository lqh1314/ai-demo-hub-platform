@echo off
chcp 65001 >nul
title AI Demo Hub 本地启动（免 Docker 版）
cd /d "%~dp0"

echo ============================================
echo   AI Demo Hub · 免 Docker 本地启动
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [未检测到 Node.js] 请先安装 Node 20 LTS 或更高版本（一路下一步即可，无需 Docker）：
  echo https://nodejs.org/zh-cn/download
  echo 安装完成后重新双击本脚本。
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJOR=%%v
if %NODEMAJOR% LSS 20 (
  echo Node 版本过低，请安装 Node 20 或更高：https://nodejs.org/zh-cn/download
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] 首次运行，安装依赖（约 2-5 分钟，只需一次）...
  call npm run local:install
  if errorlevel 1 ( echo 依赖安装失败，请把窗口报错截图发我。& pause & exit /b 1 )
)

if not exist "server\dist\src\main.js" (
  echo [2/3] 首次运行，构建前后端（约 1-3 分钟，只需一次）...
  call npm run build
  if errorlevel 1 ( echo 构建失败，请把窗口报错截图发我。& pause & exit /b 1 )
)

echo [3/3] 启动内置数据库 + 后端 + 前端，完成后会自动打开浏览器...
echo.
call npm run local
echo.
echo 服务已停止。
pause
