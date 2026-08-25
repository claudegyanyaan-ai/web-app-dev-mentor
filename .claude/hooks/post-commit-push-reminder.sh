#!/usr/bin/env bash
# PostToolUse hook: after a `git commit` Bash call, remind (never block) if
# the branch hasn't been pushed yet. Fails open on any error — never breaks
# a normal Claude Code session.

input="$(cat)"

# Defense in depth: settings.json's handler-level `if` already scopes this
# hook to `git commit` commands, but re-check the actual command string here
# too, in case that filtering behaves differently across versions.
command_str="$(printf '%s' "$input" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1)"
case "$command_str" in
  *"git commit"*) : ;;
  *) exit 0 ;;
esac

command -v git >/dev/null 2>&1 || exit 0

ahead="$(git rev-list --count '@{u}..HEAD' 2>/dev/null)" || exit 0
[ -n "$ahead" ] && [ "$ahead" -gt 0 ] 2>/dev/null || exit 0

printf '{"additionalContext": "Reminder: this branch is %s commit(s) ahead of its upstream and has not been pushed yet. Run `git push` when ready — this repo keeps push as a deliberate, reviewed step."}' "$ahead"
exit 0
