"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";

export default function StudentCourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [courseData, enrollments] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get("/me/enrollments"),
      ]);
      setCourse(courseData);
      const isEnrolled = enrollments.some((e) => e.course_id === Number(id));
      setEnrolled(isEnrolled);
      if (isEnrolled) {
        const progressData = await api.get(`/courses/${id}/progress`);
        setProgress(progressData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleEnroll() {
    setError("");
    try {
      await api.post(`/courses/${id}/enroll`, {});
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCompleteLesson(lessonId) {
    setError("");
    try {
      await api.post(`/lessons/${lessonId}/complete`, {});
      const progressData = await api.get(`/courses/${id}/progress`);
      setProgress(progressData);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!course) return <div className="p-8">Course not found.</div>;

  if (!enrolled) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <a href="/student" className="text-blue-600 text-sm">← Back to courses</a>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.description && <p className="text-gray-600">{course.description}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={handleEnroll} className="bg-blue-600 text-white rounded px-4 py-2">
          Enroll in this course
        </button>
      </div>
    );
  }

  const completedIds = new Set(progress ? progress.completed_lesson_ids : []);
  const sortedLessons = [...course.lessons].sort((a, b) => a.position - b.position);

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <a href="/student" className="text-blue-600 text-sm">← Back to courses</a>
      <h1 className="text-2xl font-bold">{course.title}</h1>
      {course.description && <p className="text-gray-600">{course.description}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {progress && (
        <div className="bg-white p-4 rounded-lg shadow space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progress.completed_lessons}/{progress.total_lessons} lessons ({progress.percent_complete}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${progress.percent_complete}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold">Lessons</h2>
        {sortedLessons.length === 0 && <p className="text-gray-500">No lessons yet.</p>}
        {sortedLessons.map((l) => {
          const done = completedIds.has(l.id);
          return (
            <div key={l.id} className="bg-white p-4 rounded-lg shadow space-y-2">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="font-semibold">{l.title}</div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{l.content}</p>
                  {l.video_url && (
                    <a href={l.video_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">
                      Watch video →
                    </a>
                  )}
                </div>
                {done ? (
                  <span className="text-green-600 text-sm whitespace-nowrap">✓ Completed</span>
                ) : (
                  <button
                    onClick={() => handleCompleteLesson(l.id)}
                    className="bg-gray-200 rounded px-3 py-1 text-sm whitespace-nowrap"
                  >
                    Mark complete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {course.quizzes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Quizzes</h2>
          {course.quizzes.map((q) => {
            const attempt = progress?.quiz_attempts.find((a) => a.quiz_id === q.id);
            return (
              <a
                key={q.id}
                href={`/student/quizzes/${q.id}`}
                className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition flex justify-between items-center"
              >
                <span>{q.title}</span>
                <span className="text-sm text-gray-500">
                  {attempt ? `Last score: ${attempt.score}/${attempt.total_questions}` : "Not attempted yet"}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
