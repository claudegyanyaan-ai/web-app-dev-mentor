"use client";

import { useState } from "react";

export default function AddTaskForm({ onAddTask }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (text.trim() === "") return;
    onAddTask(text);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-5">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a task..."
        className="flex-1 border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
      <button
        type="submit"
        className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg transition-colors"
      >
        Add
      </button>
    </form>
  );
}