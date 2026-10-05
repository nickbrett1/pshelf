# Git, Code Review, and Deployment Rules

- **Commits are allowed**: You may run `git commit` to package changes. Keep
  commits scoped to the task and use clear, conventional commit messages
  (`feat:`, `fix:`, `chore:`, ...).
- **Pushes are allowed**: You may run `git push` to push local commits to the
  remote. Prefer the repo's normal branch/PR convention (a feature branch + PR)
  over pushing straight to the default branch; if you do push to a protected
  branch, note any bypassed status checks to the user.
- **No Deployments**: Never run `wrangler deploy`, `npm run deploy`, or any other
  deployment command to push code to the production/default environment.
- **Goal**: Land changes through commits (and pushes/PRs when requested) while
  keeping diffs reviewable in VS Code — a reviewable commit history, not an
  unexplained batch.
