"use client";

const COLORS = {
  default: "bg-white",
  yellow: "bg-yellow-100",
  blue: "bg-blue-100",
  green: "bg-green-100",
  pink: "bg-pink-100",
  purple: "bg-purple-100",
};

export default function NoteCard({ note, onDelete, onTogglePin, onToggleArchive, onToggleItem }) {
  const bg = COLORS[note.color] || COLORS.default;

  return (
    <div className={`${bg} border border-zinc-200 rounded-lg p-4 shadow-sm flex flex-col gap-2`}>
      <div className="flex items-start justify-between">
        {note.title && <h3 className="font-semibold text-zinc-900">{note.title}</h3>}
        <button onClick={() => onTogglePin(note)} className="text-xs" title={note.pinned ? "Unpin" : "Pin"}>
          {note.pinned ? "📌" : "📍"}
        </button>
      </div>

      {note.type === "text" && note.content && (
        <p className="text-sm text-zinc-800 whitespace-pre-wrap">{note.content}</p>
      )}

      {note.type === "checklist" && note.items && (
        <ul className="flex flex-col gap-1">
          {note.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggleItem(note, i)}
                className="w-4 h-4 accent-teal-600"
              />
              <span className={item.done ? "line-through text-zinc-400" : ""}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-end gap-3 mt-2 text-xs">
        <button onClick={() => onToggleArchive(note)} className="text-zinc-500 hover:text-teal-600">
          {note.archived ? "Unarchive" : "Archive"}
        </button>
        <button onClick={() => onDelete(note.id)} className="text-red-500 hover:text-red-700">
          Delete
        </button>
      </div>
    </div>
  );
}