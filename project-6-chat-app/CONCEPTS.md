# Project 6 Concepts — Real-Time Chat App (1:1 + Group, PWA)

Plain-English notes on everything new in this project. Project 4/5's three-tier architecture,
FastAPI/SQLAlchemy/CORS, JWT auth, and PWA basics (manifest.json, service worker registration)
still apply and aren't repeated here.

## 1. WebSockets vs. the request/response pattern used so far
Every previous project used plain HTTP: the browser asks, the server answers, the connection
closes. A WebSocket (`wss://...`) is different — it's a single connection that stays open in
both directions, so either side can push data at any moment with no new "request" needed. This
is what makes a message sent by one user show up instantly on another user's screen without
that second user's browser ever polling or refreshing. `main.py` defines two separate WebSocket
endpoints: `/ws/conversations/{id}` for live messages inside one chat, and `/ws/presence` for
online/offline status, kept deliberately separate since they serve different UI parts and
different sets of interested users.

## 2. Authenticating a WebSocket connection
A normal HTTP request carries its JWT in an `Authorization: Bearer <token>` header — but the
browser's native WebSocket API can't set custom headers. The token is passed as a query
parameter instead (`wss://.../ws/conversations/5?token=<jwt>`), and the backend decodes and
verifies it manually right after the connection opens, closing the socket immediately if the
token is invalid. Query-string tokens are less clean than headers, but there's no other way to
authenticate a browser WebSocket handshake.

## 3. The "accept-before-close" pattern
FastAPI's WebSocket handshake has a quirk: if you reject a connection before calling
`websocket.accept()`, some clients report a generic, unhelpful "1006 abnormal closure" instead
of the real reason. `main.py` always calls `await websocket.accept()` first, then checks the
token/permissions, and calls `await websocket.close(code=...)` afterward if something's wrong —
this way the client actually receives a clean, identifiable close code instead of a mystery
disconnect.

## 4. In-memory connection managers, not the database
Two small `ConnectionManager` classes (one for chat, one for presence) keep a plain Python
dict of `{id: [open WebSocket connections]}` in server memory — not in Postgres. The database
stores durable facts (users, messages); the connection manager tracks something transient
(who's *currently* connected right now, this instant). This is also why presence resets if the
backend restarts — there's no "connected" row to survive a redeploy, which is the correct
tradeoff for something this ephemeral.

## 5. Conversations, participants, and messages — a proper join-table design
A chat needs more than a `messages` table. `Conversation` (the room itself: 1:1 or group, plus
an optional name) is linked to `User` through a separate `ConversationParticipant` join table,
rather than a fixed `user_a_id`/`user_b_id` pair on the conversation — the join-table shape is
what lets a "conversation" scale from exactly 2 people to any number of group members without
changing the schema. `Message.conversation_id` then just points at whichever conversation it
belongs to, and `Message.sender_id` at who sent it.

## 6. Deduplicating 1:1 conversations, but not group ones
Starting a new 1:1 chat with someone you already have a conversation with shouldn't create a
second, duplicate conversation. `main.py` handles this with a SQLAlchemy query that joins
`ConversationParticipant` back to itself, groups by `conversation_id`, and uses `HAVING` to find
an existing non-group conversation with exactly those two participants and no others — but only
when `is_group` is false and exactly 2 usernames were submitted. Group conversations
deliberately skip this check entirely (`if not payload.is_group and len(user_ids) == 2`),
since two different groups with the same members are a completely normal, intentional thing
(e.g. "Team A" and "Team A – Off Topic").

## 7. Presence, scoped to "contacts" only
Broadcasting every user's online/offline status to every other user on the platform doesn't
scale and isn't useful. Instead, presence updates are only pushed to users who share at least
one conversation with the user whose status changed (their "contacts") — found by querying
`ConversationParticipant` rows, not by pushing to a global list. Every backend also has a
`last_seen` timestamp column, updated when a user disconnects, so "Online" vs. "Last seen 2
hours ago" can be shown even for someone not currently connected.

## 8. Cloudinary for file/image storage
Chat attachments (images, files) aren't stored in Postgres or on the backend's own disk —
they're uploaded to Cloudinary, a third-party media host, which returns back a permanent URL
(`attachment_url`) plus a `public_id` that identifies that exact file on Cloudinary's side.
`Message.attachment_url`, `attachment_type`, and `attachment_public_id` are all stored on the
message row; the actual image bytes never touch the backend's own storage. Render's free tier
in particular has no persistent disk between deploys, so an external file host is the only
option that survives a redeploy anyway.

## 9. Delete-for-me vs. delete-for-everyone, and why they're different endpoints
WhatsApp-style delete has two distinct meanings, and this app implements both as genuinely
different operations: `DELETE /conversations/{id}/me` just sets a per-user `deleted_at`
timestamp on that one user's `ConversationParticipant` row — the conversation and its messages
are untouched for everyone else, it simply stops appearing in *this* user's list.
`DELETE /conversations/{id}` (delete-for-everyone) actually removes the `Conversation` row
(cascading to its participants and messages via `cascade="all, delete-orphan"`), and — because
messages can carry Cloudinary attachments — first loops over every message with an
`attachment_public_id` and calls Cloudinary's own delete API, so orphaned files don't sit in
storage forever after the conversation referencing them is gone.

## 10. Service workers: cache-first vs. network-first, and why it matters for updates
Project 5's service worker cached the app shell cache-first (serve from cache immediately,
never re-check the network) since a to-do/notes app's shell rarely changes. A chat app that
gets redeployed more often exposed a real problem with that strategy: browsers only re-check a
service worker for updates by comparing the `sw.js` file itself byte-for-byte — if `sw.js`'s
content never changes, the old service worker (and whatever caching strategy it implements)
keeps running indefinitely, even while the rest of the app is redeployed many times over. This
project's `sw.js` was rewritten to network-first with cache fallback: always try the real
network first, cache successful responses as a backup, and only serve from cache if the fetch
itself fails (i.e., genuinely offline). This trades a small amount of "always try the network
first" latency for never showing stale content after a deploy — the simpler fix, chosen over
building a full "new version available, click to refresh" banner/`postMessage`/`skipWaiting`
flow, which wasn't judged necessary for this project's actual needs.

## 11. Bugs debugged this project (real lessons, not scripted)
- **`device_bash` mount-path mismatch.** Writing files directly to the path
  `device_list_dir` reported (the real absolute path on the Mac) failed with "No such file or
  directory" — `device_bash` requires the `$HOME/mnt/<folder-name>/...` mount prefix instead,
  a different path to the same files.
- **PWA stuck on "Loading..." in dev mode.** The service worker's original cache-first
  strategy conflicted with `next dev`'s constantly-changing hot-reload bundle hashes, serving
  a stale cached JS chunk that never let the app's own loading state resolve. Fixed by only
  registering the service worker in production builds (`process.env.NODE_ENV !== "production"`
  guard), verified via `next build && next start`.
- **Group chat "not working" — a missing feature, not a bug.** The backend fully supported
  group conversations (`is_group`, a list of `participant_usernames`, an optional group name)
  from the start, but the frontend's "start chat" form only ever sent one username with
  `is_group` defaulting to false — there was simply no UI to create a group at all. Fixed by
  adding a "+ New Group" toggle and a group-name + comma-separated-usernames form.
- **Recurring "can't see the group / feature" reports — stale service worker after every
  deploy.** Traced to the cache-first strategy described in concept 10: users who already had
  the app open/installed kept being served an old cached JS bundle from before a given feature
  shipped, even though the deploy itself succeeded. Root-caused and fixed by switching to
  network-first (see above), rather than relying on a manual unregister-and-hard-refresh
  workaround every time.
- **Transient `/openapi.json` 404 on Render.** Swagger's "Failed to load API definition"
  correlated with a suspicious re-appearance of "Detected service running on port 10000" in
  Render's logs several minutes after the service was already live — a transient container
  restart blip, resolved by simply retrying; no code change was needed.
- **CORS blocked the deployed frontend.** Same class of bug as every prior deployed project:
  the backend's `allow_origins` needed the real Vercel production URL added before the live
  frontend could talk to the live backend — and, separately, a per-deployment Vercel *preview*
  URL was confirmed to correctly fail CORS too, since only the exact production origin is
  allowlisted.
