"use client";

import { useState, useEffect } from "react";
import TaskList from "../components/TaskList";
import AddTaskForm from "../components/AddTaskForm";

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tasks");
    if (saved) {
      setTasks(JSON.parse(saved));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }
  }, [tasks, loaded]);

  function handleAddTask(text) {
    setTasks([...tasks, { text, done: false }]);
  }

  function handleToggle(index) {
    setTasks(tasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t)));
  }

  function handleDelete(index) {
    setTasks(tasks.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold text-center mb-4">To-Do List</h1>
        <AddTaskForm onAddTask={handleAddTask} />
        <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} />
      </div>
    </div>
  );
}