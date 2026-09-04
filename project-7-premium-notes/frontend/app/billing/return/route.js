// Cashfree redirects back to the subscription's return_url using a POST
// request. A plain Next.js page only accepts GET, which returned a 405.
// This route accepts both GET and POST and forwards the browser to the
// actual app page with a normal GET request.
export async function GET(request) {
  return Response.redirect(new URL("/?upgraded=true", request.url), 303);
}

export async function POST(request) {
  return Response.redirect(new URL("/?upgraded=true", request.url), 303);
}
