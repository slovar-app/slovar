#!/usr/bin/env bash
# Публикация «Словарика» на GitHub Pages.
# Использование: ./deploy.sh "что изменилось"
set -euo pipefail
cd "$(dirname "$0")"

msg="${1:-Обновление словарика}"

git add -A
if git diff --cached --quiet; then
  echo "Изменений нет — публиковать нечего."
  exit 0
fi

git commit -m "$msg"
git push origin main

echo
echo "Готово. GitHub Pages обновится примерно через минуту."
echo "Телефон подхватит новую версию при следующем открытии с интернетом."
