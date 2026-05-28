#!/bin/bash
# 用法: ./push-to-github.sh 你的GitHub用户名
# 示例: ./push-to-github.sh zhangsan

set -e
USERNAME="$1"
REPO="toefl-vocab-buddy"

if [ -z "$USERNAME" ]; then
  echo "请提供 GitHub 用户名，例如:"
  echo "  ./push-to-github.sh 你的用户名"
  exit 1
fi

cd "$(dirname "$0")"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "请先运行: git init（或联系助手已完成初始化）"
  exit 1
fi

REMOTE="https://github.com/${USERNAME}/${REPO}.git"

echo "→ 远程仓库: $REMOTE"
echo ""
echo "若 GitHub 上还没有仓库，请先打开:"
echo "  https://github.com/new"
echo "  仓库名: ${REPO}"
echo "  选 Public，不要勾选「Add a README」"
echo "  点 Create repository 后再按回车"
read -r -p "已在 GitHub 创建好空仓库？按回车继续…"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

git branch -M main
echo "→ 正在推送（会提示登录 GitHub）…"
git push -u origin main

echo ""
echo "✅ 推送成功！"
echo "→ 开启 GitHub Pages:"
echo "  https://github.com/${USERNAME}/${REPO}/settings/pages"
echo "  Source: Deploy from branch · Branch: main · Folder: / (root) · Save"
echo ""
echo "→ 约 1～3 分钟后访问:"
echo "  https://${USERNAME}.github.io/${REPO}/"
