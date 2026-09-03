"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddTaskForm from "../components/AddTaskForm";
import TaskList from "../components/TaskList";
import AddNoteForm from "../components/AddNoteForm";
import NoteCard from "../components/NoteCard";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getMe,
  createSubscription,
  logout,
} from "../lib/api";

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [limitError, setLimitError] = useState("");
  

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadAll();
  }, []);

async function loadAll() {
    try {
      const [taskData, noteData, meData] = await Promise.all([getTasks(), getNotes(), getMe()]);
      setTasks(taskData);
      setNotes(noteData);
      setMe(meData);
    } catch (err) {
      // apiFetch already redirects to /login on 401
    } finally {
      setLoading(false);
    }
}

  // ---- Task handlers ----

  async function handleAdd(text, dueDate) {
    try {
      const newTask = await createTask(text, dueDate);
      setTasks([...tasks, newTask]);
      setLimitError("");
    } catch (err) {
      if (err.limitReached) {
        setLimitError(err.message);
      } else {
        throw err;
      }
    }
}

  async function handleToggle(id) {
    const task = tasks.find((t) => t.id === id);
    const updated = await updateTask(id, { done: !task.done });
    setTasks(tasks.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDelete(id) {
    await deleteTask(id);
    setTasks(tasks.filter((t) => t.id !== id));
  }

  async function handleEdit(id, newText) {
    const updated = await updateTask(id, { text: newText });
    setTasks(tasks.map((t) => (t.id === id ? updated : t)));
  }

  async function handleUpgrade() {
    try {
      const { subscription_id, razorpay_key_id } = await createSubscription();
      const rzp = new window.Razorpay({
        key: razorpay_key_id,
        subscription_id: subscription_id,
        name: "Premium Notes",
        description: "Premium Monthly Subscription",
        theme: { color: "#0d9488" },
        handler: function () {
          loadAll();
        },
      });
      rzp.open();
    } catch (err) {
      alert(err.message || "Could not start upgrade");
    }
}

  // ---- Note handlers ----

  async function handleAddNote(noteData) {
    try {
      const newNote = await createNote(noteData);
      setNotes([newNote, ...notes]);
      setLimitError("");
    } catch (err) {
      if (err.limitReached) {
        setLimitError(err.message);
      } else {
        throw err;
      }
    }
}

  async function handleDeleteNote(id) {
    await deleteNote(id);
    setNotes(notes.filter((n) => n.id !== id));
  }

  async function handleTogglePin(note) {
    const updated = await updateNote(note.id, { pinned: !note.pinned });
    setNotes(notes.map((n) => (n.id === note.id ? updated : n)));
  }

  async function handleToggleArchive(note) {
    const updated = await updateNote(note.id, { archived: !note.archived });
    setNotes(notes.map((n) => (n.id === note.id ? updated : n)));
  }

  async function handleToggleItem(note, itemIndex) {
    const newItems = note.items.map((item, i) =>
      i === itemIndex ? { ...item, done: !item.done } : item
    );
    const updated = await updateNote(note.id, { items: newItems });
    setNotes(notes.map((n) => (n.id === note.id ? updated : n)));
  }

  if (loading) {
    return <div className="p-8 text-zinc-500">Loading...</div>;
  }

  const activeNotes = notes.filter((n) => !n.archived);
  const pinnedNotes = activeNotes.filter((n) => n.pinned);
  const otherNotes = activeNotes.filter((n) => !n.pinned);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">My Tasks &amp; Notes</h1>
        <button onClick={logout} className="text-sm text-zinc-500 hover:text-red-500">
          Log out
        </button>
      </div>
            {me && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm">
          <span className="text-teal-800">
            {me.plan === "premium"
              ? "You're on Premium — unlimited notes & tasks."
              : `Free plan: ${tasks.length + notes.length}/5 items used`}
          </span>
          {me.plan !== "premium" && (
            <button onClick={handleUpgrade} className="rounded-md bg-teal-600 px-3 py-1 text-white hover:bg-teal-700">
              Upgrade to Premium — ₹149/mo
            </button>
          )}
        </div>
      )}

      {limitError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>{limitError}</span>
          <button onClick={handleUpgrade} className="rounded-md bg-amber-600 px-3 py-1 text-white hover:bg-amber-700">
            Upgrade
          </button>
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-zinc-800 mb-3">Tasks</h2>
        <AddTaskForm onAdd={handleAdd} />
        <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-800 mb-3">Notes</h2>
        <AddNoteForm onAdd={handleAddNote} />

        {pinnedNotes.length > 0 && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Pinned</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onDelete={handleDeleteNote}
                  onTogglePin={handleTogglePin}
                  onToggleArchive={handleToggleArchive}
                  onToggleItem={handleToggleItem}
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {otherNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={handleDeleteNote}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
              onToggleItem={handleToggleItem}
            />
          ))}
        </div>
      </section>
    </main>
  );
}