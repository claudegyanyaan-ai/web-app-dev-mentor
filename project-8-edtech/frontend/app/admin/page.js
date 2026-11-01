"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

export default function AdminHome() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ title: "", description: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function loadCourses() {
    try {
      const data = await api.get("/courses");
      setCourses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.me().then((me) => {
      if (me.role !== "admin") {
        router.replace("/student");
        return;
      }
      loadCourses();
    }).catch(() => router.replace("/login"));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/admin/courses", form);
      setForm({ title: "", description: "" });
      loadCourses();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow space-y-3">
        <h2 className="font-semibold">New Course</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Course title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          className="w-full border rounded px-3 py-2"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button className="bg-blue-600 text-white rounded px-4 py-2" type="submit">
          Create Course
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold">Courses</h2>
        {courses.length === 0 && <p className="text-gray-500">No courses yet.</p>}
        {courses.map((c) => (
          <a
            key={c.id}
            href={`/admin/courses/${c.id}`}
            className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition"
          >
            <div className="font-semibold">{c.title}</div>
            {c.description && <div className="text-sm text-gray-500">{c.description}</div>}
          </a>
        ))}
      </div>
    </div>
  );
}
