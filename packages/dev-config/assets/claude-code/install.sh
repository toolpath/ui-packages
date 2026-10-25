#!/usr/bin/env bash
# Copies the optional Claude Code worker and Orchestrator output style into
# CLAUDE_CONFIG_DIR (default ~/.claude), then prints the launch command. Every
# target is checked before anything is written; identical files are kept. It
# never edits settings and never copies other instructions or skills.
set -euo pipefail

source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
files=(agents/worker.md output-styles/orchestrator.md)

for file in "${files[@]}"; do
  if [[ -e "$config_dir/$file" || -L "$config_dir/$file" ]] && ! cmp -s "$source_dir/$file" "$config_dir/$file"; then
    printf 'Existing file differs: %s\nMerge or move it before installing. Nothing changed.\n' "$config_dir/$file" >&2
    exit 1
  fi
done

mkdir -p "$config_dir/agents" "$config_dir/output-styles"
config_dir="$(cd -- "$config_dir" && pwd)"
for file in "${files[@]}"; do
  if [[ ! -e "$config_dir/$file" ]]; then
    cp "$source_dir/$file" "$config_dir/$file"
  fi
done

printf 'Claude files installed in %s\n\nStart the orchestrator:\n' "$config_dir"
printf 'CLAUDE_CONFIG_DIR=%q ' "$config_dir"
cat <<'EOF'
claude --model opus --effort xhigh --settings '{"outputStyle":"Orchestrator"}'
EOF
