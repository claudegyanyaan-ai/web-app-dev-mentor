# Project 8 Concepts — Mini EdTech Platform

Plain-English notes on everything new in this project. Project 4-7's three-tier architecture,
FastAPI/SQLAlchemy/CORS, JWT auth, and PWA basics still apply and aren't repeated here.

## 1. Role-based access, not just logged-in-or-not
Every prior project only asked "is there a valid JWT?" Project 8 is the first one that also asks
"what kind of user is this?" — a `role` column on `User` (`student` / `admin`), and a
`require_admin()` dependency that chains off the existing `get_current_user()` and raises 403 if
the role doesn't match. Course/lesson/quiz creation, editing, and deletion all sit behind
`require_admin()`; browsing, enrolling, and taking quizzes sit behind the plain
`get_current_user()`. The first admin account can't self-service sign up as admin — it was
promoted by hand with a direct SQL `UPDATE` on the real database, which is the normal pattern for
bootstrapping the very first privileged account in any system like this.

## 2. Hiding answers isn't a frontend problem — it's a response-shape problem
A multiple-choice quiz has to store which option is correct somewhere, and the API has to return
quiz questions to students so they can take the quiz. The naive version returns the exact same
quiz object to everyone and just tells the frontend "don't render `is_correct`" — but that answer
is still sitting in the JSON anyone can read from the browser's network tab. The real fix is two
separate Pydantic schemas: `QuizOut` (no `is_correct` field, for students) and `QuizAdminOut`
(includes it, admin-only). The database has one `Quiz`/`Question`/`Option` model; which schema a
given endpoint returns is what actually controls what leaves the server. Grading itself — scoring
a submitted attempt against the correct answers — also happens entirely server-side, never by
trusting a score the client calculates and submits.

## 3. A relationship you forgot to add fails silently, not loudly
`Course` and `Lesson` had a SQLAlchemy relationship from the start, but `Course` and `Quiz` didn't
— an oversight, not a deliberate choice. Nothing crashed because of it; `course.quizzes` just
wasn't a thing you could access, and deleting a course left its quizzes orphaned in the database
instead of cascading. It only surfaced once the quiz-builder UI needed to list a course's quizzes.
The fix was a normal two-sided relationship (`back_populates` on both `Course.quizzes` and
`Quiz.course`, with `cascade="all, delete-orphan"`) — the lesson is that a missing relationship
doesn't throw an error pointing at itself; it shows up later as a feature that mysteriously can't
be built the way you'd expect.

## 4. Enrollment as a gate, not just a record
A `CourseEnrollment` row isn't only "this student is enrolled" for display purposes — it's the
actual authorization check. `POST /lessons/{id}/complete` looks up whether an enrollment row
exists for that student/course before it'll record a completion; without one, it returns 403,
even if the student is a valid logged-in user who could technically see the lesson content.
Progress percentage (`completed_lessons / total_lessons`) is only meaningful once that gate
exists — a logged-in-but-not-enrolled student has no progress to compute at all.

## 5. Idempotent writes: marking something complete twice shouldn't double-count it
`POST /lessons/{id}/complete` is safe to call more than once for the same lesson — it checks for
an existing `LessonCompletion` row first and does nothing (not an error, not a duplicate row) if
one's already there. This matters because a real frontend can retry a request, or a user can
double-click a button, and "mark complete" is the kind of action that should be safe to repeat
without corrupting the progress count.

## 6. `create-next-app --skip-install` for cross-platform scaffolding
When Claude builds a Next.js project directly on your Mac through the device bridge, that bridge
runs in its own separate Linux sandbox — not your actual Mac. Running `npm install` there would
bake Linux-native binaries into `node_modules`, which then silently fail on your real macOS
Terminal. `--skip-install` scaffolds all the project files (package.json, app/ folder, configs)
without touching `node_modules` at all, so you run `npm install` yourself afterward, on your own
machine, producing binaries that actually match your OS. Same root cause as the Python venv
lesson from Step 1 — anything that needs to *run* with real OS-native binaries has to be installed
on the machine that will actually run it.

## 7. One service worker can hijack every project on the same port
Projects 5, 6, and 7 all registered a PWA service worker scoped to `localhost:3000` (the default
Next.js dev port). A service worker's scope is the *browser origin*, not "this one project" — so
starting Project 8's dev server on the same port doesn't clear out an old project's still-active
service worker. It kept intercepting every request and serving stale cached JS/CSS/HTML from
whichever earlier project last registered one, making a brand-new Project 8 page look completely
unstyled and broken, with login silently doing nothing. The tell is DevTools → Network tab showing
`(ServiceWorker)` as the Initiator for every request instead of the real dev server. Fix:
DevTools → Application → Service Workers → Unregister, then Application → Storage → Clear site
data, then a fresh tab.

## 8. Network-first vs. cache-first service worker strategy
Project 8's own PWA service worker deliberately copies Project 6's *network-first* pattern
(always try the real network first, fall back to cache only if offline, and skip caching entirely
for API calls to the backend) rather than Project 5/7's older *cache-first* pattern (serve from
cache immediately if present). Cache-first is what made the Step 6 incident above possible in the
first place — it happily keeps serving old cached content even when a dev server right next to it
has newer output. Network-first avoids that whole class of bug, at the small cost of needing a
real network round-trip on every load when online.

## 9. Relative import depth in nested App Router routes
Next.js App Router routes are just nested folders (`app/admin/courses/[id]/quizzes/new/page.js`),
and a relative import like `../../../lib/api.js` has to count the exact number of folder levels
between the file and the project root — get the count wrong and you get a build-time "Module not
found" error, not a vague runtime bug. Different routes at different nesting depths need a
different number of `../`, even within the same feature (the quiz *create* page and the quiz
*edit* page in this project sit at different depths and needed 6 vs. 5). The fix each time is
mechanical (count folders, or resolve the path programmatically), but it only shows up once you
actually try to build/run that specific page — nothing earlier catches it.

## 10. `git push` ≠ code is live, twice over
Two separate gaps sit between "code is committed" and "users are running it": first, a commit
made through the device bridge sandbox stays local to your Mac — the sandbox has no stored GitHub
credentials, so `git push` has to be run by you, in your own Terminal, where your real credentials
live. Second, even after a push reaches GitHub, Render's auto-deploy can take a moment to notice
or (as hit in Project 7 too) can be switched off entirely — the Deploys tab showing a fresh
"Deploy succeeded" for the *new* commit hash is the actual proof something is live, not the push
succeeding.

## 11. CORS has to name the real deployed origin, not just localhost
`allow_origins` on the backend is a literal list of browser origins allowed to call the API — it
has nothing to do with whether the API itself is reachable. Once the frontend moved from
`localhost:3000` to a real `*.vercel.app` domain, every request failed in the browser with
"Failed to fetch" even though the backend was fully live and healthy — the backend was correctly
rejecting a request from an origin it didn't recognize. The fix is adding the exact deployed
frontend URL to `allow_origins`, redeploying the backend, and nothing else — the frontend code
itself needs no change at all.

## 12. Bugs found this project (real lessons, not scripted)
1. **Missing `Course`↔`Quiz` relationship** — never added when `Quiz` was first modeled; blocked
   `course.quizzes` access and cascade-delete until added.
2. **Leftover service worker from an earlier project hijacking `localhost:3000`** — made a brand
   new Project 8 page look completely broken/unstyled; fixed via DevTools Unregister + Clear site
   data.
3. **Relative import path-depth miscount** — `../../../../../lib/api` (5 ups) instead of 6 in the
   quiz-create page, a one-level-deeper route than the quiz-edit page that got it right.
4. **`git push` failing from the device-bridge sandbox** — no stored GitHub credentials there by
   design; expected, not a real bug, but worth naming as a recurring limitation.
5. **Render's "Add from .env" paste not parsing correctly** — the full `KEY=VALUE` line landed in
   the KEY field as one string instead of being split; worked around by adding both environment
   variables manually instead.
6. **CORS blocking the real deployed frontend** — backend only allowed `localhost:3000` until the
   live Vercel origin was explicitly added to `allow_origins`.
7. **Render not auto-redeploying immediately after the CORS-fix push** — same class of issue as
   Project 7's auto-deploy gap; resolved with a manual "Deploy latest commit".
