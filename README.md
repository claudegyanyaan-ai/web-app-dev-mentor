# Web & App Dev Mentor Track

A 10-project ladder learning full-stack web/app development — one folder per project inside this repo, each deployed to a live URL. Built with Claude as mentor: Claude writes the code, explains the architecture and concepts as they come up, and the learner reviews, runs, and directs each step.

See `progress-dashboard.html` (open in a browser) for the master status tracker across all 10 projects.

## Tech stack
- Frontend: HTML/CSS/JS → React via Next.js from Project 3 onward
- Styling: Tailwind CSS (from the projects where it's introduced)
- Backend: Python (FastAPI)
- Database: PostgreSQL (Supabase/Neon free tier)
- Hosting: Vercel (frontend), Render/Railway (backend)
- Version control: GitHub — combined repo (this one) for all 10 projects

## Projects
- [x] Project 1: Portfolio site — `project-1-portfolio/`
- [ ] Project 2: Interactive to-do app (vanilla JS + localStorage)
- [ ] Project 3: To-do app rebuilt in React/Next.js
- [ ] Project 4: Full-stack CRUD app (Next.js + FastAPI + Postgres)
- [ ] Project 5: Auth-enabled app + first PWA packaging
- [ ] Project 6: Real-time feature app
- [x] Project 7: Premium Notes — payments-enabled app (Cashfree subscriptions, INR)
- [ ] Project 8: Mini EdTech platform
- [ ] Project 9: Flagship 1 — Education platform
- [ ] Project 10: Flagship 2 — Stock trading / screener app

## How this repo is organized
Each `project-N-*` folder is self-contained: its own code, its own `README.md`, `CONCEPTS.md` (plain-English notes on concepts introduced in that project), `progress.html` (that project's status tracker), and a `chat-logs/` folder with timestamped mentoring session logs.
