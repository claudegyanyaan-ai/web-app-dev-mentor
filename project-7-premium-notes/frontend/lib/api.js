const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Not authenticated");
  }

  return res;
}


// ---- Auth ----

export async function signup(email, password) {
  const res = await fetch(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Signup failed");
  return res.json();
}

export async function login(email, password) {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();
  localStorage.setItem("token", data.access_token);
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}


// ---- Tasks ----

export async function getTasks() {
  const res = await apiFetch("/tasks");
  return res.json();
}
export async function createTask(text, due_date = null) {
  const res = await apiFetch("/tasks", {
    method: "POST",
    body: JSON.stringify({ text, due_date }),
  });
  if (res.status === 403) {
    const data = await res.json();
    const err = new Error(data.detail);
    err.limitReached = true;
    throw err;
  }
  return res.json();
}
export async function updateTask(id, updates) {
  const res = await apiFetch(`/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return res.json();
}
export async function deleteTask(id) {
  await apiFetch(`/tasks/${id}`, { method: "DELETE" });
}


// ---- Notes ----

export async function getNotes() {
  const res = await apiFetch("/notes");
  return res.json();
}
export async function createNote(note) {
  const res = await apiFetch("/notes", {
    method: "POST",
    body: JSON.stringify(note),
  });
  if (res.status === 403) {
    const data = await res.json();
    const err = new Error(data.detail);
    err.limitReached = true;
    throw err;
  }
  return res.json();
}
export async function updateNote(id, updates) {
  const res = await apiFetch(`/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return res.json();
}
export async function deleteNote(id) {
  await apiFetch(`/notes/${id}`, { method: "DELETE" });
}

// ---- Billing ----

export async function getMe() {
  const res = await apiFetch("/me");
  return res.json();
}

export async function createSubscription() {
  const res = await apiFetch("/billing/create-subscription", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Could not start subscription");
  }
  return res.json();
}


