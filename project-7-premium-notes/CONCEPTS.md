# Project 7 Concepts — Premium Notes (Subscription Billing)

Plain-English notes on everything new in this project. Project 4/5's three-tier architecture,
FastAPI/SQLAlchemy/CORS, JWT auth, and PWA basics still apply and aren't repeated here.

## 1. Freemium gating: server-side, not client-side
The free-plan cap (5 tasks + notes total) is enforced in `main.py`'s `check_item_limit()`,
called on every task/note creation — never trusted from the frontend. A client-side check alone
could be bypassed by anyone calling the API directly; the real limit has to live wherever the
write actually happens.

## 2. What a "subscription" actually is to a payment gateway
Unlike a one-time payment, a subscription is a standing authorization: the customer approves
recurring debits up to a plan's amount/interval once (the "mandate"), and the gateway
auto-charges on schedule afterward without the customer re-entering payment details each time.
That authorization step — not a single payment — is what the whole checkout flow in this
project is built around.

## 3. Why the payment gateway itself had to be swapped mid-project
Razorpay's own dashboard checkout failed with a generic error on a brand-new test account, plan,
and keys — the same reproduction that ruled out anything in this project's code. Not every bug
is yours to fix: sometimes the platform itself is broken in a way no amount of local debugging
will solve, and the correct response is to isolate that conclusively (reproduce it in the
simplest possible way, outside your own code) and switch rather than keep guessing.

## 4. Cashfree Subscriptions API shape
The client generates its own unique `subscription_id` and POSTs it (with customer + plan
details) to `/pg/subscriptions`; Cashfree responds with a `subscription_session_id`, which the
frontend hands to its JS SDK to actually render the hosted checkout page. This differs from
Razorpay, where the gateway assigns the subscription ID.

## 5. `checkout()` vs. `subscriptionsCheckout()` — payments and subscriptions are different SDK calls
Cashfree's JS SDK has genuinely separate entry points for a one-time payment session
(`cashfree.checkout({ paymentSessionId })`) and a subscription/mandate session
(`cashfree.subscriptionsCheckout({ subsSessionId })`). Passing a subscription session ID into
the payment method doesn't throw a clear error — it silently does nothing, or fails on the
gateway's own page. When a documented SDK call "doesn't work" with no error, checking whether
it's even the right call for the situation is worth doing before assuming the parameters are
wrong.

## 6. Webhook signature verification: HMAC over `timestamp + raw body`
Cashfree signs webhooks by concatenating the `x-webhook-timestamp` header with the *raw*
(unparsed) request body, HMAC-SHA256 with the account's Client Secret, base64-encoding the
result, and comparing it to the `x-webhook-signature` header. The raw body matters — parsing
JSON first and re-serializing it can change whitespace/key order enough to break the signature,
so the body has to be read and hashed before it's ever decoded as JSON. Cashfree also has no
separate "webhook secret" the way some gateways do — it's the same Client Secret used for API
calls.

## 7. Don't trust a payload's shape without seeing a real one
The webhook handler was first written from a reasonable guess at the JSON structure
(`data.subscription.subscription_id`) — and that guess was wrong. Cashfree actually nests it as
`data.subscription_details.subscription_id` (and separately duplicates `subscription_id` one
level up for some event types). The bug produced no errors and no crashes — the handler just
silently found nothing to update, every single time. The fix only became obvious once an actual
delivered payload was pulled from Cashfree's own Webhook Logs and read directly, rather than
inferred from docs or assumption.

## 8. A webhook event firing isn't the same as the state it implies being final
A `SUBSCRIPTION_AUTH_STATUS` event firing doesn't mean the mandate is fully authorized — its own
payload can (and did) show `subscription_status: "BANK_APPROVAL_PENDING"`, a genuinely
in-progress state. The correct trigger for granting Premium is the actual status value inside
the payload (`== "ACTIVE"`), not the event's name.

## 9. A pushed commit isn't a deployed commit
`git push` updates GitHub; it doesn't necessarily redeploy a hosted service. If a Render (or
similar) service has auto-deploy-on-push disabled, code can sit correctly on GitHub indefinitely
while the live service keeps running the old version — with no error anywhere to indicate it.
The Render dashboard's Events/Logs tab, showing which exact commit is actually live, is the
source of truth here, not "I pushed it."

## 10. Reusing a database column across a completely different provider
Rather than adding a new `cashfree_subscription_id` column (which `Base.metadata.create_all()`
can't retroactively add to an existing table without a real migration), the existing
`razorpay_subscription_id` column was deliberately kept and repurposed to store Cashfree's ID
instead. The column name is now slightly misleading, but it avoided any schema migration risk
for a value that's opaque to the app either way — a pragmatic tradeoff worth naming explicitly
rather than leaving as an unexplained inconsistency.

## 11. Why a payment gateway's callback redirect needs its own route
Some gateways redirect the customer back to your `return_url` using an HTTP POST (carrying
callback data in the request), not a GET like a normal link click. A plain page route only
handles GET by default and returns a 405 for anything else. The fix is a small dedicated route
that accepts both methods and forwards the browser into a normal GET page load — not something
that shows up until you actually test the full round trip.

## 12. Local dev and PWA service workers don't mix well
A cache-first service worker (built for the *production* PWA experience) can intercept and
serve stale copies of both the app's own JS bundles and third-party scripts during
`npm run dev`, since it doesn't know the difference between "this changed because I edited it"
and "this is just a normal cache hit." Registering it only in production, and actively
unregistering/clearing it in development, avoids debugging phantom bugs that are really just
stale cached code.

## 13. Bugs found this project (real lessons, not scripted)
1. **Wrong Cashfree SDK method** — `checkout()` used for a subscription session instead of
   `subscriptionsCheckout()`; silently no-op'd rather than erroring.
2. **Service worker intercepting the Cashfree SDK script in dev** — fixed by gating
   registration to production only.
3. **405 on the payment gateway's return redirect** — Cashfree POSTs back to `return_url`; a
   plain Next.js page only accepts GET.
4. **`SECRET_KEY` accidentally deleted from Render** while swapping payment-gateway env vars —
   broke every login (JWT signing) while leaving signup unaffected, diagnosed by checking the
   real HTTP status code rather than trusting the frontend's generic error text.
5. **Webhook handler reading the wrong JSON path** — guessed structure vs. the real delivered
   payload, silently matched nothing every time.
6. **A deployed fix that was never actually deployed** — Render's auto-deploy-on-push was off;
   the pushed commit sat unbuilt until a manual deploy was triggered.
