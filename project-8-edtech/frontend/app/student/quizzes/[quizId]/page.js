"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";

export default function TakeQuiz() {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [quizData, attemptsData] = await Promise.all([
        api.get(`/quizzes/${quizId}`),
        api.get(`/quizzes/${quizId}/attempts`),
      ]);
      setQuiz(quizData);
      setAttempts(attemptsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [quizId]);

  function selectOption(questionId, optionId) {
    setAnswers({ ...answers, [questionId]: optionId });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (Object.keys(answers).length < quiz.questions.length) {
      setError("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([question_id, selected_option_id]) => ({
          question_id: Number(question_id),
          selected_option_id,
        })),
      };
      const attempt = await api.post(`/quizzes/${quizId}/submit`, payload);
      setResult(attempt);
      const attemptsData = await api.get(`/quizzes/${quizId}/attempts`);
      setAttempts(attemptsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetake() {
    setAnswers({});
    setResult(null);
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!quiz) return <div className="p-8">Quiz not found.</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <a href={`/student/courses/${quiz.course_id}`} className="text-blue-600 text-sm">← Back to course</a>
      <h1 className="text-2xl font-bold">{quiz.title}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {result ? (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-semibold">
            You scored {result.score}/{result.total_questions}
          </h2>
          <button onClick={handleRetake} className="bg-blue-600 text-white rounded px-4 py-2">
            Retake Quiz
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {quiz.questions.map((q, qIndex) => (
            <div key={q.id} className="bg-white p-4 rounded-lg shadow space-y-2">
              <div className="font-semibold">{qIndex + 1}. {q.question_text}</div>
              <div className="space-y-1">
                {q.options.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === opt.id}
                      onChange={() => selectOption(q.id, opt.id)}
                    />
                    {opt.option_text}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
        </form>
      )}

      {attempts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Attempt History</h2>
          {attempts.map((a) => (
            <div key={a.id} className="bg-white p-3 rounded-lg shadow flex justify-between text-sm">
              <span>{new Date(a.attempted_at).toLocaleString()}</span>
              <span>{a.score}/{a.total_questions}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
