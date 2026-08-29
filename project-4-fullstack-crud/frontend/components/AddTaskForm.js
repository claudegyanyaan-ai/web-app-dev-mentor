"use client";
import { useState } from "react";

export default function AddTaskForm({ onAddTask }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onAddTask(text);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a task..."
        className="flex-1 border border-zinc-300 rounded px-3 py-2 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <button
        type="submit"
        className="bg-teal-600 text-white px-4 py-2 rounded font-medium hover:bg-teal-700"
      >
        Add
      </button>
    </form>
  );
}