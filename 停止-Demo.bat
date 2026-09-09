@echo off
chcp 65001 >nul
title AI Demo Hub 停止
cd /d "%~dp0"
echo 正在停止 AI Demo Hub 全部容器（数据保留，下次启动仍在）...
docker compose down
echo.
echo 已停止。如需清空演示数据恢复初始状态，请执行：docker compose down -v
pause
