const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/^http/, "ws");

export function openConversationSocket(conversationId, token, handlers) {
  const ws = new WebSocket(`${WS_URL}/ws/conversations/${conversationId}?token=${token}`);
  if (handlers.onOpen) ws.onopen = handlers.onOpen;
  if (handlers.onClose) ws.onclose = handlers.onClose;
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handlers.onMessage?.(data);
  };
  return ws;
}

export function openPresenceSocket(token, handlers) {
  const ws = new WebSocket(`${WS_URL}/ws/presence?token=${token}`);
  if (handlers.onOpen) ws.onopen = handlers.onOpen;
  if (handlers.onClose) ws.onclose = handlers.onClose;
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handlers.onPresence?.(data);
  };
  return ws;
}
