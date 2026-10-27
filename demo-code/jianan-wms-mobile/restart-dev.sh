#!/bin/bash
# 统一的 dev server 重启脚本：先杀掉占用 5173 的所有旧进程，再起一个新实例。
# 约定（CLAUDE.md / 用户要求）：任何时刻本机只保留一个 dev server，
# 严禁起新实例后把旧实例遗留在后台（此前曾一下午堆积 7 个被用户批评）。
# 用法：bash restart-dev.sh   （前台运行，Ctrl+C 停止即杀）

PORT=5173

# 杀掉占用端口的旧进程（可能存在 node 主进程 + 子进程多个 PID）
PIDS=$(netstat -ano | grep -E "TCP.*:${PORT}.*LISTENING" | awk '{print $NF}' | sort -u)
if [ -n "$PIDS" ]; then
  echo "[restart-dev] 杀掉旧 dev server 进程: $PIDS"
  for pid in $PIDS; do
    taskkill //F //T //PID "$pid" >/dev/null 2>&1
  done
  sleep 1
else
  echo "[restart-dev] 端口 ${PORT} 无旧进程"
fi

echo "[restart-dev] 启动新实例..."
npm.cmd run dev
