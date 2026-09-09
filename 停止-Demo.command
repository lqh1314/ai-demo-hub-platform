#!/bin/bash
# AI Demo Hub · macOS 停止（双击运行）
cd "$(dirname "$0")"
echo "正在停止 AI Demo Hub 全部容器（数据保留）..."
docker compose down
echo "已停止。如需清空演示数据：docker compose down -v"
sleep 4
