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
  logout,
} from "../lib/api";

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
      const [taskData, noteData] = await Promise.all([getTasks(), getNotes()]);
      setTasks(taskData);
      setNotes(noteData);
    } catch (err) {
      // apiFetch already redirects to /login on 401
    } finally {
      setLoading(false);
    }
  }

  // ---- Task handlers ----

  async function handleAdd(text, dueDate) {
    const newTask = await createTask(text, dueDate);
    setTasks([...tasks, newTask]);
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

  // ---- Note handlers ----

  async function handleAddNote(noteData) {
    const newNote = await createNote(noteData);
    setNotes([newNote, ...notes]);
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