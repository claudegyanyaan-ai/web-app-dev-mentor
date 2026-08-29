"use client";
import { useState, useEffect } from "react";
import AddTaskForm from "../components/AddTaskForm";
import TaskList from "../components/TaskList";
import { getTasks, createTask, updateTask, deleteTask } from "../lib/api";

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTasks().then((data) => {
      setTasks(data);
      setLoading(false);
    });
  }, []);

  async function handleAddTask(text) {
    const newTask = await createTask(text);
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

  return (
    <div className="min-h-screen bg-zinc-50 flex items-start justify-center pt-16">
      <div className="bg-white shadow rounded-lg p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-4 text-zinc-900">To-Do List</h1>
        <AddTaskForm onAddTask={handleAddTask} />
        {loading ? (
          <p className="text-zinc-400 text-sm">Loading tasks...</p>
        ) : (
          <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} />
        )}
      </div>
    </div>
  );
}