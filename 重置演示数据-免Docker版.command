#!/bin/bash
cd "$(dirname "$0")"
rm -rf .local-pgdata
echo "已清空内置数据库，重新双击「启动-免Docker版.command」即可自动重建。"
sleep 4
