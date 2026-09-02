const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Request failed");
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function signup(username, email, password) {
  return apiFetch("/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login(username, password) {
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Login failed");
  }

  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export function logout() {
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export async function forgotPassword(email) {
  return apiFetch("/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, newPassword) {
  return apiFetch("/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export async function getCurrentUser() {
  return apiFetch("/me");
}

export async function listConversations() {
  return apiFetch("/conversations");
}

export async function createConversation(participantUsernames, isGroup = false, name = null) {
  return apiFetch("/conversations", {
    method: "POST",
    body: JSON.stringify({
      participant_usernames: participantUsernames,
      is_group: isGroup,
      name,
    }),
  });
}

export async function listMessages(conversationId) {
  return apiFetch(`/conversations/${conversationId}/messages`);
}

export async function sendMessage(conversationId, content) {
  return apiFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function uploadAttachment(conversationId, file, caption = "") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("caption", caption);

  return apiFetch(`/conversations/${conversationId}/messages/upload`, {
    method: "POST",
    body: formData,
  });
}

export async function getConversationPresence(conversationId) {
  return apiFetch(`/conversations/${conversationId}/presence`);
}

export async function deleteConversationForMe(conversationId) {
  return apiFetch(`/conversations/${conversationId}/me`, { method: "DELETE" });
}

export async function deleteConversationForEveryone(conversationId) {
  return apiFetch(`/conversations/${conversationId}`, { method: "DELETE" });
}
