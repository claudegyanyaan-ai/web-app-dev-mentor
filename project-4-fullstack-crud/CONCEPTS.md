# Project 4 Concepts — Full-Stack CRUD App

Plain-English notes on everything new in this project. Project 3's React concepts
(components, props, useState, useEffect) still apply on the frontend side and aren't
repeated here.

## 1. The three-tier architecture
Instead of one piece of code, this app is three separate, independently deployed programs
that talk to each other over the network:
- **Frontend (Next.js, on Vercel)** — what the user sees and clicks.
- **Backend (FastAPI, on Render)** — the only piece allowed to talk to the database.
  Frontend code runs inside the user's own browser, visible to anyone via dev tools, so it
  must never hold database credentials directly.
- **Database (Postgres, on Neon)** — permanent storage, organized as tables.
Every action flows: frontend → fetch request → backend → database → backend → frontend →
screen updates. Two network hops per action, not zero like Projects 1-3.

## 2. FastAPI + uvicorn
FastAPI is the Python framework used to define API endpoints (`@app.get("/tasks")` etc.) --
it's just code describing what should happen for each URL/method combination. uvicorn is
the actual program that runs that code and listens for real network requests; FastAPI alone
does nothing until uvicorn is started (`uvicorn main:app --reload`).

## 3. CRUD and REST endpoints
CRUD = Create, Read, Update, Delete -- the four basic operations almost any app needs.
This project maps them onto four HTTP endpoints:
- `POST /tasks` — Create
- `GET /tasks` — Read
- `PUT /tasks/{task_id}` — Update
- `DELETE /tasks/{task_id}` — Delete
The `{task_id}` in a URL is a *path parameter* -- e.g. a request to `/tasks/3` targets the
task with id 3.

## 4. SQLAlchemy: models, engine, sessions
SQLAlchemy is a toolkit that lets Python talk to Postgres using Python classes instead of
writing raw SQL. Three pieces work together:
- `models.py`'s `Task` class (inheriting from `Base`) describes the `tasks` TABLE shape --
  what columns exist in the database.
- `database.py`'s `engine` is the actual open connection to Neon, built from the
  `DATABASE_URL` environment variable.
- `SessionLocal` is a factory for individual "conversations" with the database; `get_db()`
  in `main.py` opens one fresh session per request and guarantees it closes afterward
  (`try / finally`), even if something goes wrong mid-request.
`Base.metadata.create_all(bind=engine)` is the line that actually creates the real `tasks`
table inside Postgres the first time the app starts, based on the `Task` model.

## 5. Pydantic schemas vs. SQLAlchemy models
Two different "shapes" exist in this app, on purpose:
- `models.py` = the DATABASE shape (what's stored).
- `schemas.py` = the API TRAFFIC shape (what a request must contain, what a response looks
  like) -- `TaskCreate`, `TaskUpdate`, `TaskOut`.
`TaskUpdate`'s fields are optional (`text: str | None = None`) so a request can send just
`{"done": true}` without also having to resend the text -- but this also means: whatever
IS included in the request body gets applied, even a leftover placeholder value like
Swagger's default `"string"`. Nothing is skipped just because it "looks like" a placeholder.

## 6. Environment variables and .env
An environment variable is a setting read from OUTSIDE the code itself, so secrets (like a
database password) never get hardcoded or committed to git. `python-dotenv`'s `load_dotenv()`
reads a local `.env` file and makes its values available via `os.getenv("DATABASE_URL")`.
`.env` is listed in `.gitignore` so it never reaches GitHub. The exact same Key/Value concept
reappears when deploying: Render and Vercel both have their own "Environment Variables"
settings pages, since a deployed server obviously doesn't have your local `.env` file.

## 7. CORS (Cross-Origin Resource Sharing)
Browsers block a webpage on one address (e.g. the Vercel frontend) from calling a different
address (e.g. the Render backend) unless the backend explicitly allows it. FastAPI's
`CORSMiddleware` with `allow_origins=[...]` is that explicit allow-list. Forgetting to add a
newly deployed frontend's real URL here is a common, very recognizable failure: the page
loads fine but any fetch silently fails, with a distinctive error in the browser console
("blocked by CORS policy... No 'Access-Control-Allow-Origin' header").

## 8. The database is now the source of truth
In Project 3, the `tasks` array in React WAS the data — localStorage was just backup.
Here, Postgres is the real data, and React's `tasks` state is only a local copy/cache of it.
Every handler (`handleAddTask`, `handleToggle`, `handleDelete`, `handleEdit`) does the real
write to the backend FIRST (`await createTask(...)` etc.), and only updates the screen
afterward, once the database has actually confirmed the change.

## 9. NEXT_PUBLIC_ environment variables
Next.js keeps most environment variables backend-only/secret by default. Any variable that
needs to be readable in browser-side code (like `lib/api.js`'s `API_URL`) must be prefixed
`NEXT_PUBLIC_`. `.env.local` holds this for local development; Vercel's dashboard holds the
real deployed value.

## 10. Deploying two separate services
Unlike Projects 1-3 (one static/Next.js site), this project has two independent
deployments that both need to succeed AND be correctly configured to find each other:
- Render (backend): Root Directory scoped to `backend/`, a Start Command that actually
  matches this project (`uvicorn main:app --host 0.0.0.0 --port $PORT` — Render's own
  default placeholder assumes Django/gunicorn and will not work for FastAPI), and the
  `DATABASE_URL` environment variable set.
- Vercel (frontend): Root Directory scoped to `frontend/`, and `NEXT_PUBLIC_API_URL` set to
  the Render backend's real public URL.
- The backend's CORS allow-list must include the frontend's real deployed URL, or the two
  services simply won't be allowed to talk once both are live.
Render's free tier also spins an idle backend down; the first request after a period of
inactivity can take up to ~50 seconds to wake it back up -- not a bug, just the free tier's
tradeoff.

## 11. Bugs debugged this project (real lessons, not scripted)
- A UTF-8 BOM added by PowerShell's `Out-File -Encoding utf8` silently broke
  python-dotenv's ability to read `.env` -- fixed by editing the file directly in a text
  editor instead of via that PowerShell command.
- A malformed connection string (wrong scheme prefix, missing `@` separator) produced a
  different, more specific SQLAlchemy error once the BOM issue was fixed -- read error
  messages carefully; they usually narrow down exactly what's still wrong.
- Local Claude Code (VS Code agent) auto-committing and pushing as a side effect of an
  unrelated fix -- always worth checking `git log` / `git status` before assuming nothing
  has been pushed yet.
- CORS blocking the live frontend after deployment -- diagnosed via the browser's DevTools
  Console, which names the exact blocked origin and reason.
