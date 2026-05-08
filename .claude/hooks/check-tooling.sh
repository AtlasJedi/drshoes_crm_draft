#!/usr/bin/env bash
# PreToolUse hook for Agent and Skill tools.
# Enforces tooling-isolation rule: this project declares `tooling: superpowers`
# in CLAUDE.md, so cross-ecosystem agents/skills (forge-*, gsd-*, gstack, etc.)
# must be blocked deterministically — the model cannot be trusted to remember
# the rule across /clear.
#
# Receives Claude Code hook input JSON on stdin:
#   { "tool_name": "Agent" | "Skill" | ..., "tool_input": { ... } }
# Returns JSON to deny via permissionDecision per the PreToolUse contract.

set -uo pipefail

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"

deny() {
  # $1 = reason text. Emits PreToolUse JSON deny + exits 0 (JSON drives the block).
  jq -nc --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

case "$tool" in
  Agent)
    sub="$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // empty')"
    [[ -z "$sub" ]] && exit 0

    case "$sub" in
      forge-*|gsd-*|gstack-*|vercel:*|majorfucker)
        deny "[tooling-lock] BLOCKED subagent_type='$sub'.

This project declares 'tooling: superpowers' in CLAUDE.md. Cross-ecosystem
subagents (forge-*, gsd-*, gstack-*, vercel:*) are blocked by
.claude/hooks/check-tooling.sh.

Allowed: general-purpose, Explore, Plan, statusline-setup, callitaday,
claude-code-guide.

For backend Spring Boot work in this project, dispatch a general-purpose
Sonnet subagent and brief it with the plan path + thin instructions.
Do NOT loosen this hook to make a forge-* call go through — that defeats
the entire safeguard. If a legitimate need arises, raise it with the user
and edit the allowlist explicitly."
        ;;
    esac
    ;;

  Skill)
    skill="$(printf '%s' "$input" | jq -r '.tool_input.skill // empty')"
    [[ -z "$skill" ]] && exit 0

    deny_skill=0
    # Prefix-based deny
    case "$skill" in
      gsd-*|vercel:*|gstack-*) deny_skill=1 ;;
    esac

    # Exact-match deny (gstack-flavored skills with no prefix)
    if [[ "$deny_skill" == 0 ]]; then
      case "$skill" in
        gstack|bradlej|browse|qa|qa-only|ship|dev|canary|health|cso|\
investigate|office-hours|land-and-deploy|setup-deploy|setup-browser-cookies|\
open-gstack-browser|lesson-studio|manifest|ports|remote|publish_local|\
checkpoint|go|document-release|retro|test-loop|benchmark|debug-e2e|autoplan|\
design-shotgun|design-html|design-consultation|design-review|\
plan-design-review|plan-ceo-review|plan-eng-review|plan-devex-review|\
devex-review)
          deny_skill=1
          ;;
      esac
    fi

    if [[ "$deny_skill" == 1 ]]; then
      deny "[tooling-lock] BLOCKED skill='$skill'.

This project declares 'tooling: superpowers' in CLAUDE.md. Cross-ecosystem
skills (gsd-*, gstack-*, vercel:*, gstack-flavored slash commands) are
blocked by .claude/hooks/check-tooling.sh.

Use superpowers:* skills (brainstorming, writing-plans,
test-driven-development, subagent-driven-development, executing-plans,
systematic-debugging, etc.) or harness-internal skills (update-config,
keybindings-help, loop, schedule).

Do NOT loosen this hook to make a gstack/gsd call go through. If a
legitimate need arises, raise it with the user and edit the allowlist
explicitly."
    fi
    ;;
esac

exit 0
