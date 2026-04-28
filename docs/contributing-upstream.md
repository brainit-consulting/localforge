# Contributing to the Upstream Repo

This document explains how to safely make your own changes to this fork and how to contribute enhancements back to [leonvanzyl/localforge](https://github.com/leonvanzyl/localforge).

## Repository layout

```
leonvanzyl/localforge          ← Leon's original (upstream)
        ↑
brainit-consulting/localforge  ← Your fork on GitHub (origin)
        ↑
h:\localforge                  ← Your local working copy
```

Your local repo has two remotes configured:

| Remote | URL |
|---|---|
| `origin` | https://github.com/brainit-consulting/localforge |
| `upstream` | https://github.com/leonvanzyl/localforge |

## Day-to-day: making your own changes

Work on `main` as normal. Your fork is yours — commit and push freely.

```bash
git add <files>
git commit -m "your message"
git push origin main
```

## Keeping up with Leon's changes

Before starting any new work, pull in anything Leon has shipped:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

Do this regularly to avoid large merge conflicts later.

## Contributing back upstream

### 1. Sync with upstream first

```bash
git fetch upstream
git merge upstream/main
```

### 2. Create a feature branch off Leon's latest

```bash
git checkout -b feat/your-feature-name upstream/main
```

Always branch from `upstream/main`, not from your `main`. This keeps the PR diff clean — it will only show your new changes, not the accumulated differences between your fork and his.

### 3. Make your changes and commit

```bash
git add <files>
git commit -m "feat: describe what you added"
```

If your changes already exist as commits on your `main`, cherry-pick them instead:

```bash
git cherry-pick <commit-hash>
```

To find the hash: `git log --oneline main`

### 4. Push the branch to your fork

```bash
git push -u origin feat/your-feature-name
```

### 5. Open the pull request

```bash
gh pr create \
  --repo leonvanzyl/localforge \
  --head brainit-consulting:feat/your-feature-name \
  --base main \
  --title "feat: short description" \
  --body "describe what changed and why"
```

### 6. Clean up after merge

Once Leon merges your PR:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
git branch -d feat/your-feature-name
git push origin --delete feat/your-feature-name
```

## What to include vs. exclude in a PR

**Include:**
- The feature or fix itself
- Any assets it depends on

**Exclude:**
- Changes to `README.md` that are specific to your fork (clone URL, credits section)
- Anything that only makes sense in your version of the app

## Tips for a PR Leon will want to merge

- One focused PR per feature — don't bundle unrelated changes
- Keep `package.json` clean — avoid adding dependencies unless necessary
- Briefly note in the PR body that there are no breaking changes if that's true
- A short table of changed files with a one-line description of each goes a long way
