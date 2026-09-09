#!/bin/bash
# AI Demo Hub · macOS 一键启动（双击运行）
cd "$(dirname "$0")"
echo "============================================"
echo "  AI Demo Hub · 接线机器人+电销工作台"
echo "============================================"

if ! command -v docker >/dev/null 2>&1; then
  echo "[未检测到 Docker] 请先安装 Docker Desktop：https://www.docker.com/products/docker-desktop/"
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker 尚未就绪，正在启动 Docker Desktop..."
  open -a Docker 2>/dev/null
  n=0
  until docker info >/dev/null 2>&1; do
    sleep 3; n=$((n+1)); echo "  等待 Docker 引擎启动... ($n)"
    [ $n -ge 40 ] && { echo "Docker 启动超时，请手动打开 Docker Desktop 后重试。"; exit 1; }
  done
fi

echo "[1/3] 构建并启动容器（首次约需 3-8 分钟）..."
docker compose up -d --build || { echo "启动失败，请把终端报错截图发我。"; read -n 1 -s -r -p "按任意键退出..."; exit 1; }

echo "[2/3] 等待后端就绪..."
n=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' aihub-api 2>/dev/null)" = "healthy" ]; do
  sleep 3; n=$((n+1)); echo "  后端启动中... ($n)"
  [ $n -ge 30 ] && break
done

echo "[3/3] 打开浏览器..."
sleep 2
open http://localhost:8080
echo "============================================"
echo " 已启动：http://localhost:8080  账号 admin / Aihub@123456"
echo " 停止服务双击「停止-Demo.command」"
echo "============================================"
sleep 6
