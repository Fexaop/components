#!/usr/bin/env bash
USER="jcKawin"
declare -A totals

for repo in $(gh repo list $USER --limit 1000 --json name -q '.[].name'); do
  echo "Fetching $repo..."
  for row in $(gh api repos/$USER/$repo/languages --jq 'to_entries[] | "\(.key)=\(.value)"'); do
    lang=${row%=*}
    lines=${row#*=}
    ((totals[$lang]+=lines))
  done
done

echo -e "\n=== Total lines per language across all repos ==="
for lang in "${!totals[@]}"; do
  printf "%-15s %d\n" "$lang" "${totals[$lang]}"
done
