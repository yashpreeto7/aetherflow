---
name: context-sync
description: "Force-saves all AuraOS project context to disk. Use at the end of every session, before switching accounts/models, after completing a major task, or when context loss is feared. Updates CONTEXT.md, HANDOFF.md, SESSION_LOG.md, and stores key facts in claude-mem."
user-invocable: true
---

# Context Sync Skill

This skill saves your entire working context to disk so it survives:
- Account switches
- Model switches (Claude → Gemini → GPT etc.)
- `/clear` commands
- Browser/app crashes
- Long gaps between sessions

## When to Run This

**Always run at:**
- The END of every working session
- Before switching AI accounts
- After completing a major task (e.g., finished Task 1 in REMAINING_TASKS.md)
- Any time you feel uncertain about what was done

---

## Step 1: Update CONTEXT.md

Update `C:\Users\Yashpreet_o7\Desktop\AURAOS\CONTEXT.md` with:

1. **Last Updated** — change the timestamp to right now
2. **Build Status** — update which checks pass/fail based on what you just tested
3. **File Completion Status** — move any newly completed files from ❌ to ✅
4. **Next Immediate Action** — update to the NEXT unchecked task in REMAINING_TASKS.md
5. **Session Log** — append a new row to the table:

```markdown
| 2026-XX-XX | [Model Name] | [What you just did — 1-2 sentences] |
```

---

## Step 2: Update HANDOFF.md

In `C:\Users\Yashpreet_o7\Desktop\AURAOS\HANDOFF.md`:

1. Change the status emoji at the top:
   - 🔴 = broken build
   - 🟡 = in progress (default)
   - ✅ = fully complete

2. In "What Remains" section, check off completed tasks:
   - Change `- [ ]` to `- [x]`

---

## Step 3: Update REMAINING_TASKS.md

In `C:\Users\Yashpreet_o7\Desktop\AURAOS\REMAINING_TASKS.md`:

At the "Completion Checklist" at the bottom, change `[ ]` to `[x]` for any completed tasks.

---

## Step 4: Append to SESSION_LOG.md

Append to `C:\Users\Yashpreet_o7\Desktop\AURAOS\SESSION_LOG.md`:

```markdown
---
## Session: [DATE] [TIME]
- **Agent:** [Model name and version]
- **Duration:** [Approximate time]
- **Completed:**
  - [Task 1 you did]
  - [Task 2 you did]
- **Build status:** [✅ Passes / ❌ Fails — error message]
- **Next session should:** [First unchecked task in REMAINING_TASKS.md]
---
```

---

## Step 5: Verify build one final time

```powershell
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run build
```

Record the result in the Session Log (Step 4).

---

## Step 6: Self-test recovery

To verify the context will survive a session reset, ask yourself:
- [ ] Can a new agent read CONTEXT.md and know exactly what state the project is in?
- [ ] Does REMAINING_TASKS.md show only unchecked items for what's actually unfinished?
- [ ] Is the Session Log updated with what was done?
- [ ] Does `npm run build` pass?

If all yes — context is properly saved. You can switch accounts/models safely.

---

## Quick Reference: Files That Carry Context

| File | What it stores | Update frequency |
|------|---------------|-----------------|
| `CONTEXT.md` | Full project state, completion map | Every session |
| `HANDOFF.md` | Detailed session state + resume instructions | Every session |
| `REMAINING_TASKS.md` | Exact step-by-step tasks, checkboxes | After each task |
| `SESSION_LOG.md` | Chronological log of all sessions | Every session |
| `AGENTS.md` | Permanent project rules | Rarely (only if arch changes) |
| `.agents/skills/auraos-resume/` | Auto-loader skill | Rarely |
