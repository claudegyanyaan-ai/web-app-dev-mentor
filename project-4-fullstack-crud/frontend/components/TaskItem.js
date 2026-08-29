import { useState } from "react";

export default function TaskItem({ task, onToggle, onDelete, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);

  function handleSave() {
    if (editText.trim()) {
      onEdit(task.id, editText);
    }
    setIsEditing(false);
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b border-zinc-200 last:border-b-0">
      <div className="flex items-center gap-3 flex-1">
        <input
          type="checkbox"
          checked={task.done}
          onChange={() => onToggle(task.id)}
          className="w-5 h-5 accent-teal-600"
        />
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="flex-1 border border-zinc-300 rounded px-2 py-1 text-zinc-900"
            autoFocus
          />
        ) : (
          <span className={task.done ? "line-through text-zinc-400" : "text-zinc-900"}>
            {task.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isEditing ? (
          <button onClick={handleSave} className="text-teal-600 text-sm font-medium hover:text-teal-800">
            Save
          </button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="text-blue-500 text-sm font-medium hover:text-blue-700">
            Edit
          </button>
        )}
        <button onClick={() => onDelete(task.id)} className="text-red-500 text-sm font-medium hover:text-red-700">
          Delete
        </button>
      </div>
    </li>
  );
}