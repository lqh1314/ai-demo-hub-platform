#!/bin/bash
# AI Demo Hub · 免 Docker 本地启动（macOS 双击运行，只需安装 Node 20+）
cd "$(dirname "$0")"
echo "============================================"
echo "  AI Demo Hub · 免 Docker 本地启动"
echo "============================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[未检测到 Node.js] 请先安装 Node 20 LTS 或更高（无需 Docker）：https://nodejs.org/zh-cn/download"
  read -n 1 -s -r -p "按任意键退出..."; exit 1
fi
MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$MAJOR" -lt 20 ] 2>/dev/null; then
  echo "Node 版本过低，请安装 Node 20 或更高：https://nodejs.org/zh-cn/download"
  read -n 1 -s -r -p "按任意键退出..."; exit 1
fi

if [ ! -d node_modules ]; then
  echo "[1/3] 首次运行，安装依赖（约 2-5 分钟，只需一次）..."
  npm run local:install || { echo "依赖安装失败，请把终端报错截图发我。"; read -n 1 -s -r -p "按任意键退出..."; exit 1; }
fi
if [ ! -f server/dist/src/main.js ]; then
  echo "[2/3] 首次运行，构建前后端（约 1-3 分钟，只需一次）..."
  npm run build || { echo "构建失败，请把终端报错截图发我。"; read -n 1 -s -r -p "按任意键退出..."; exit 1; }
fi

echo "[3/3] 启动内置数据库 + 后端 + 前端，完成后自动打开浏览器..."
npm run local
