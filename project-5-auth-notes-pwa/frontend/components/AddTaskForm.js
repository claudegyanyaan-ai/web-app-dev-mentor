"use client";

import { useState } from "react";

export default function AddTaskForm({ onAdd }) {
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text, dueDate || null);
    setText("");
    setDueDate("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a task..."
        className="flex-1 min-w-[150px] border border-zinc-300 rounded px-3 py-2 text-zinc-900"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="border border-zinc-300 rounded px-3 py-2 text-zinc-900"
      />
      <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700">
        Add
      </button>
    </form>
  );
}