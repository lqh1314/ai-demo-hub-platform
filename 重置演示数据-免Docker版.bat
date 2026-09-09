@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 将清空内置数据库并恢复初始演示数据...
rmdir /s /q .local-pgdata 2>nul
echo 已清空，重新双击「启动-免Docker版.bat」即可自动重建。
pause
