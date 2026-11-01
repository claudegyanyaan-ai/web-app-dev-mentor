"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

export default function StudentHome() {
  const [courses, setCourses] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load() {
    try {
      const [coursesData, enrollments] = await Promise.all([
        api.get("/courses"),
        api.get("/me/enrollments"),
      ]);
      setCourses(coursesData);
      setEnrolledIds(new Set(enrollments.map((e) => e.course_id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.me().then((me) => {
      if (me.role === "admin") {
        router.replace("/admin");
        return;
      }
      load();
    }).catch(() => router.replace("/login"));
  }, []);

  async function handleEnroll(courseId) {
    setError("");
    try {
      await api.post(`/courses/${courseId}/enroll`, {});
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Courses</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-3">
        {courses.length === 0 && <p className="text-gray-500">No courses available yet.</p>}
        {courses.map((c) => {
          const enrolled = enrolledIds.has(c.id);
          return (
            <div key={c.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center gap-4">
              <div>
                <div className="font-semibold">{c.title}</div>
                {c.description && <div className="text-sm text-gray-500">{c.description}</div>}
              </div>
              {enrolled ? (
                <a href={`/student/courses/${c.id}`} className="bg-blue-600 text-white rounded px-4 py-2 text-sm whitespace-nowrap">
                  Continue
                </a>
              ) : (
                <button
                  onClick={() => handleEnroll(c.id)}
                  className="bg-gray-200 rounded px-4 py-2 text-sm whitespace-nowrap"
                >
                  Enroll
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
