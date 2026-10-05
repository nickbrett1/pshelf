# Git, Code Review, and Deployment Rules

- **Commits are allowed**: You may run `git commit` to package changes. Keep
  commits scoped to the task and use clear, conventional commit messages
  (`feat:`, `fix:`, `chore:`, ...).
- **Pushes are allowed**: You may run `git push` to push local commits to the
  remote. Prefer the repo's normal branch/PR convention (a feature branch + PR)
  over pushing straight to the default branch; if you do push to a protected
  branch, note any bypassed status checks to the user.
- **Deployments are allowed**: You may run deployment commands (e.g.
  `wrangler deploy`, `npm run deploy`) when asked, including to a
  production/default environment. Prefer the repo's standard CI/CD pipeline
  where one exists, and tell the user what you deployed and where.
- **Goal**: Land changes through commits, pushes/PRs, and deployments when
  requested, while keeping diffs reviewable in VS Code — a reviewable commit
  history, not an unexplained batch.
