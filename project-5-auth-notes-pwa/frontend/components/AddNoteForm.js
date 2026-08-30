"use client";

import { useState } from "react";

const COLOR_OPTIONS = [
  { name: "default", swatch: "bg-white" },
  { name: "yellow", swatch: "bg-yellow-200" },
  { name: "blue", swatch: "bg-blue-200" },
  { name: "green", swatch: "bg-green-200" },
  { name: "pink", swatch: "bg-pink-200" },
  { name: "purple", swatch: "bg-purple-200" },
];

export default function AddNoteForm({ onAdd }) {
  const [type, setType] = useState("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [itemText, setItemText] = useState("");
  const [items, setItems] = useState([]);
  const [color, setColor] = useState("default");

  function addItem() {
    if (!itemText.trim()) return;
    setItems([...items, { text: itemText, done: false }]);
    setItemText("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (type === "text" && !content.trim() && !title.trim()) return;
    if (type === "checklist" && items.length === 0 && !title.trim()) return;

    onAdd({
      type,
      title: title || null,
      content: type === "text" ? content : null,
      items: type === "checklist" ? items : null,
      color,
    });

    setTitle("");
    setContent("");
    setItems([]);
    setColor("default");
    setType("text");
  }

  return (
    <form onSubmit={handleSubmit} className="border border-zinc-300 rounded-lg p-4 mb-6 flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("text")}
          className={`text-sm px-3 py-1 rounded ${type === "text" ? "bg-teal-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          Text
        </button>
        <button
          type="button"
          onClick={() => setType("checklist")}
          className={`text-sm px-3 py-1 rounded ${type === "checklist" ? "bg-teal-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          Checklist
        </button>
      </div>

      <input
        type="text"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border border-zinc-300 rounded px-3 py-2 text-zinc-900"
      />

      {type === "text" ? (
        <textarea
          placeholder="Note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border border-zinc-300 rounded px-3 py-2 text-zinc-900"
          rows={3}
        />
      ) : (
        <div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Add item..."
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              className="flex-1 border border-zinc-300 rounded px-3 py-2 text-zinc-900"
            />
            <button type="button" onClick={addItem} className="bg-zinc-200 px-3 py-2 rounded text-zinc-900">
              + Item
            </button>
          </div>
          <ul className="text-sm text-zinc-700">
            {items.map((it, i) => (
              <li key={i}>• {it.text}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600">Color:</span>
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setColor(c.name)}
            className={`w-6 h-6 rounded-full border-2 ${c.swatch} ${color === c.name ? "border-teal-600" : "border-zinc-300"}`}
          />
        ))}
      </div>

      <button type="submit" className="bg-teal-600 text-white py-2 rounded hover:bg-teal-700">
        Add Note
      </button>
    </form>
  );
}