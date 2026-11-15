# Publish checklist

Steps to put Rover Engineer online and finish the submission. Nothing here has been run yet: publishing waits for the team. Submission closes November 15, 2026, 11:59 pm local event time.

## 1. Game link (Vercel)

The Vercel CLI is installed and logged in on the dev Mac. The production build uses relative paths (`base: './'` in `game/vite.config.ts`), so it works at a domain root or under a sub-path. The built game is about 15 MB.

```bash
cd game
npm test && npm run build      # both must pass
vercel --prod                  # first run asks to link a project: scope, name "rover-engineer", directory ./
```

Vercel detects Vite: the build command is `npm run build` and the output is `dist`. The command prints the public URL.

**Alternative: GitHub Pages.** Push the repo and serve `game/dist` from a `gh-pages` branch or a Pages workflow. The relative base path makes `/rover-engineer/` work without changes.

## 2. Repository link

- The remote is `github.com/chieri518/rover-engineer`. All work is on the local branch `v1-moon`.
- Decide whether to merge `v1-moon` into `main` or push it as is. Check that the repository is public.
- The push must include `LICENSE` (MIT).
- The untracked `.claude/` folder (local Claude Code state) should stay out of the commit.

## 3. Fill in the submission texts

In `project-description.md`:

- `TODO: GAME URL`: the Vercel URL.
- `TODO: REPOSITORY URL`: the GitHub URL.
- `TODO: DEMO LINK`: the 30-second video or slide deck, which the event requires.
- `TODO: TEAM MEMBER NAMES`: omit anyone under 18.

Then remove the draft banners from both `project-description.md` and `ai-disclosure.md`. Paste the one-paragraph "Form version" of the disclosure into the AI field.

## 4. Final test

- Open the game URL in a private window, in Chrome and one other browser if possible.
- Design a rover, launch it, drive, and reach the debrief.
- Check that the credits screen opens.
