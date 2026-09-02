"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  getCurrentUser,
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
  uploadAttachment,
  getConversationPresence,
  deleteConversationForMe,
  deleteConversationForEveryone,
  logout,
} from "../lib/api";
import { openConversationSocket, openPresenceSocket } from "../lib/ws";

export default function ChatPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [presence, setPresence] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupUsernames, setGroupUsernames] = useState("");
  const [loading, setLoading] = useState(true);

  const conversationSocketRef = useRef(null);
  const presenceSocketRef = useRef(null);
  const fileInputRef = useRef(null);

  function mergePresence(list) {
    setPresence((prev) => {
      const next = { ...prev };
      for (const p of list) {
        next[p.user_id] = { online: p.online, last_seen: p.last_seen };
      }
      return next;
    });
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    async function init() {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);

        const convos = await listConversations();
        setConversations(convos);

        const presenceLists = await Promise.all(
          convos.map((c) => getConversationPresence(c.id).catch(() => []))
        );
        presenceLists.forEach(mergePresence);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token || !currentUser) return;

    const ws = openPresenceSocket(token, {
      onPresence: (data) => {
        mergePresence([
          { user_id: data.user_id, online: data.status === "online", last_seen: data.last_seen },
        ]);
      },
    });
    presenceSocketRef.current = ws;

    return () => {
      ws.close();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!activeConversationId) return;

    let cancelled = false;

    async function loadConversation() {
      try {
        const msgs = await listMessages(activeConversationId);
        if (!cancelled) setMessages(msgs);

        const presenceList = await getConversationPresence(activeConversationId);
        if (!cancelled) mergePresence(presenceList);
      } catch (err) {
        console.error(err);
      }
    }

    loadConversation();

    const token = getToken();
    const ws = openConversationSocket(activeConversationId, token, {
      onMessage: (data) => {
        setMessages((prev) => [...prev, data]);
      },
    });
    conversationSocketRef.current = ws;

    return () => {
      cancelled = true;
      ws.close();
    };
  }, [activeConversationId]);

  function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const ws = conversationSocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content: newMessage }));
    } else {
      sendMessage(activeConversationId, newMessage).then((msg) => {
        setMessages((prev) => [...prev, msg]);
      });
    }
    setNewMessage("");
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    try {
      await uploadAttachment(activeConversationId, file);
    } catch (err) {
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleStartConversation(e) {
    e.preventDefault();
    if (!newUsername.trim()) return;

    try {
      const convo = await createConversation([newUsername.trim()]);
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === convo.id);
        return exists ? prev : [convo, ...prev];
      });
      setActiveConversationId(convo.id);
      setNewUsername("");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!groupName.trim() || !groupUsernames.trim()) {
      alert("Please enter a group name and at least one username.");
      return;
    }

    const usernames = groupUsernames
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    if (usernames.length === 0) {
      alert("Please enter at least one username.");
      return;
    }

    try {
      const convo = await createConversation(usernames, true, groupName.trim());
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === convo.id);
        return exists ? prev : [convo, ...prev];
      });
      setActiveConversationId(convo.id);
      setGroupName("");
      setGroupUsernames("");
      setShowGroupForm(false);
    } catch (err) {
      alert(err.message);
    }
  }

  function removeConversationLocally(conversationId) {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      setMessages([]);
    }
  }

  async function handleDeleteForMe(conversationId) {
    try {
      await deleteConversationForMe(conversationId);
      removeConversationLocally(conversationId);
    } catch (err) {
      alert(err.message);
    } finally {
      setOpenMenuId(null);
    }
  }

  async function handleDeleteForEveryone(conversationId) {
    const confirmed = window.confirm(
      "Delete this conversation for everyone? This cannot be undone."
    );
    if (!confirmed) {
      setOpenMenuId(null);
      return;
    }
    try {
      await deleteConversationForEveryone(conversationId);
      removeConversationLocally(conversationId);
    } catch (err) {
      alert(err.message);
    } finally {
      setOpenMenuId(null);
    }
  }

  function otherParticipant(conversation) {
    if (!currentUser) return null;
    return conversation.participants.find((p) => p.id !== currentUser.id) || null;
  }

  function handleLogout() {
    if (conversationSocketRef.current) conversationSocketRef.current.close();
    if (presenceSocketRef.current) presenceSocketRef.current.close();
    logout();
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">{currentUser?.username}</p>
            <p className="text-xs text-gray-500">{currentUser?.email}</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">
            Log out
          </button>
        </div>

        <form onSubmit={handleStartConversation} className="p-4 border-b border-gray-200 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Start chat with username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <button type="submit" className="bg-teal-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-teal-700">
              Start
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowGroupForm((v) => !v)}
            className="text-sm text-teal-600 hover:underline text-left"
          >
            {showGroupForm ? "Cancel" : "+ New Group"}
          </button>
        </form>

        {showGroupForm && (
          <form onSubmit={handleCreateGroup} className="p-4 border-b border-gray-200 flex flex-col gap-2 bg-gray-50">
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <input
              type="text"
              placeholder="Usernames, comma separated"
              value={groupUsernames}
              onChange={(e) => setGroupUsernames(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <button
              type="submit"
              className="bg-teal-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-teal-700"
            >
              Create Group
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
          )}
          {conversations.map((c) => {
            const other = otherParticipant(c);
            const isOnline = other && presence[other.id]?.online;
            const label = c.is_group ? c.name || "Group chat" : other?.username || "Unknown";

            return (
              <div
                key={c.id}
                className={`relative flex items-center justify-between px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  activeConversationId === c.id ? "bg-teal-50" : ""
                }`}
              >
                <button
                  onClick={() => setActiveConversationId(c.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {!c.is_group && (
                    <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                  )}
                  <span className="text-sm text-gray-800">{label}</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                    className="text-gray-400 hover:text-gray-700 px-2"
                  >
                    ⋮
                  </button>
                  {openMenuId === c.id && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 text-sm">
                      <button
                        onClick={() => handleDeleteForMe(c.id)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        Delete for me
                      </button>
                      <button
                        onClick={() => handleDeleteForEveryone(c.id)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600"
                      >
                        Delete for everyone
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation to start chatting
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-200 bg-white">
              <p className="font-semibold text-gray-800">
                {activeConversation.is_group
                  ? activeConversation.name || "Group chat"
                  : otherParticipant(activeConversation)?.username}
              </p>
              {!activeConversation.is_group &&
                (() => {
                  const other = otherParticipant(activeConversation);
                  const p = other && presence[other.id];
                  if (!p) return null;
                  return (
                    <p className="text-xs text-gray-500">
                      {p.online
                        ? "Online"
                        : p.last_seen
                        ? `Last seen ${new Date(p.last_seen).toLocaleString()}`
                        : "Offline"}
                    </p>
                  );
                })()}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const isMine = m.sender_id === currentUser?.id;
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                        isMine ? "bg-teal-600 text-white" : "bg-white border border-gray-200 text-gray-800"
                      }`}
                    >
                      {!isMine && <p className="text-xs font-medium mb-1 opacity-70">{m.sender_username}</p>}
                      {m.attachment_url && m.attachment_type === "image" && (
                        <img src={m.attachment_url} alt="attachment" className="rounded-lg mb-1 max-w-full" />
                      )}
                      {m.attachment_url && m.attachment_type === "file" && (
                        <a
                          href={m.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`underline block mb-1 ${isMine ? "text-white" : "text-teal-600"}`}
                        >
                          📎 View file
                        </a>
                      )}
                      {m.content && <p>{m.content}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xl px-2"
                title="Attach file"
              >
                📎
              </button>
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button type="submit" className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-teal-700">
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
