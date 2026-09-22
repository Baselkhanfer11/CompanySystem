# CompanySystem — project notes for Claude

## Commits
- **Do NOT add `Co-Authored-By` trailers or any Claude attribution line to commit messages.** Commits are authored by Baselkhanfer11 only.
- Keep commit messages short and clear.

## Stack
- Backend: ASP.NET Core Web API (.NET 9, C#) + EF Core + SQL Server.
- Frontend: React 19 + Vite + TypeScript. Use **Bun** (`bun install`, `bun run dev`) — never npm.

## Workflow
- Run `git add .` from the repo **root**, not from `backend/` or `frontend/`.
- The user runs git commands themselves in the VS 2022 Developer PowerShell; explain each step.
