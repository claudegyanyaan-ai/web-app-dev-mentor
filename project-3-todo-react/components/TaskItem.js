export default function TaskItem({ task, onToggle, onDelete }) {
  return (
    <li className="flex items-center gap-3 px-1 py-2.5 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
      <input
        type="checkbox"
        checked={task.done}
        onChange={onToggle}
        className="w-4 h-4 accent-teal-600 cursor-pointer flex-shrink-0"
      />
      <span
        className={
          "flex-1 " +
          (task.done ? "line-through text-zinc-400" : "")
        }
      >
        {task.text}
      </span>
      <button
        onClick={onDelete}
        className="text-red-500 text-sm hover:text-red-700 transition-colors"
      >
        Delete
      </button>
    </li>
  );
}