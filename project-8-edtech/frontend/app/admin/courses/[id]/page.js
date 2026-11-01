"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../lib/api";

export default function AdminCourseDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ title: "", description: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", content: "", video_url: "", position: 0 });
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api.get(`/courses/${id}`);
      setCourse(data);
      setCourseForm({ title: data.title, description: data.description || "" });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleCourseUpdate(e) {
    e.preventDefault();
    setError("");
    try {
      await api.put(`/admin/courses/${id}`, courseForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCourseDelete() {
    if (!confirm("Delete this course and all its lessons?")) return;
    try {
      await api.del(`/admin/courses/${id}`);
      router.push("/admin");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLessonSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        title: lessonForm.title,
        content: lessonForm.content,
        video_url: lessonForm.video_url || null,
        position: Number(lessonForm.position) || 0,
      };
      if (editingLessonId) {
        await api.put(`/admin/lessons/${editingLessonId}`, payload);
      } else {
        await api.post(`/admin/courses/${id}/lessons`, payload);
      }
      setLessonForm({ title: "", content: "", video_url: "", position: 0 });
      setEditingLessonId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditLesson(lesson) {
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      content: lesson.content,
      video_url: lesson.video_url || "",
      position: lesson.position,
    });
  }

  async function handleLessonDelete(lessonId) {
    if (!confirm("Delete this lesson?")) return;
    try {
      await api.del(`/admin/lessons/${lessonId}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!course) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <a href="/admin" className="text-blue-600 text-sm">← Back to courses</a>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={handleCourseUpdate} className="bg-white p-6 rounded-lg shadow space-y-3">
        <h2 className="font-semibold">Course details</h2>
        <input
          className="w-full border rounded px-3 py-2"
          value={courseForm.title}
          onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
        />
        <textarea
          className="w-full border rounded px-3 py-2"
          value={courseForm.description}
          onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
        />
        <div className="flex gap-2">
          <button className="bg-blue-600 text-white rounded px-4 py-2" type="submit">
            Save
          </button>
          <button
            type="button"
            onClick={handleCourseDelete}
            className="bg-red-600 text-white rounded px-4 py-2"
          >
            Delete course
          </button>
        </div>
      </form>

      <div className="bg-white p-6 rounded-lg shadow space-y-3">
        <h2 className="font-semibold">{editingLessonId ? "Edit lesson" : "Add lesson"}</h2>
        <form onSubmit={handleLessonSubmit} className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Lesson title"
            value={lessonForm.title}
            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
          />
          <textarea
            className="w-full border rounded px-3 py-2"
            placeholder="Content (text)"
            value={lessonForm.content}
            onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Embedded video URL (optional)"
            value={lessonForm.video_url}
            onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
          />
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            placeholder="Position (order)"
            value={lessonForm.position}
            onChange={(e) => setLessonForm({ ...lessonForm, position: e.target.value })}
          />
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white rounded px-4 py-2" type="submit">
              {editingLessonId ? "Update lesson" : "Add lesson"}
            </button>
            {editingLessonId && (
              <button
                type="button"
                className="bg-gray-300 rounded px-4 py-2"
                onClick={() => {
                  setEditingLessonId(null);
                  setLessonForm({ title: "", content: "", video_url: "", position: 0 });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Quizzes</h2>
          <a href={`/admin/courses/${id}/quizzes/new`} className="text-blue-600 text-sm">+ New Quiz</a>
        </div>
        {course.quizzes.length === 0 && <p className="text-gray-500">No quizzes yet.</p>}
        {course.quizzes.map((q) => (
          <a
            key={q.id}
            href={`/admin/quizzes/${q.id}/edit`}
            className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition"
          >
            {q.title}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Lessons</h2>
        {course.lessons.length === 0 && <p className="text-gray-500">No lessons yet.</p>}
        {[...course.lessons].sort((a, b) => a.position - b.position).map((l) => (
          <div key={l.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-start">
            <div>
              <div className="font-semibold">{l.position}. {l.title}</div>
              <div className="text-sm text-gray-500 line-clamp-2">{l.content}</div>
              {l.video_url && <div className="text-xs text-blue-600">{l.video_url}</div>}
            </div>
            <div className="flex gap-2 text-sm">
              <button className="text-blue-600" onClick={() => startEditLesson(l)}>Edit</button>
              <button className="text-red-600" onClick={() => handleLessonDelete(l.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
