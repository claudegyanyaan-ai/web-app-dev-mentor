"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../../lib/api";

export default function EditQuiz() {
  const { quizId } = useParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [courseId, setCourseId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/quizzes/${quizId}`).then((quiz) => {
      setTitle(quiz.title);
      setCourseId(quiz.course_id);
      setQuestions(
        quiz.questions.map((q, i) => ({
          question_text: q.question_text,
          position: i,
          options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
        }))
      );
      setLoading(false);
    }).catch((err) => setError(err.message));
  }, [quizId]);

  function addQuestion() {
    setQuestions([...questions, { question_text: "", position: questions.length, options: [{ option_text: "", is_correct: true }, { option_text: "", is_correct: false }] }]);
  }

  function removeQuestion(qIndex) {
    setQuestions(questions.filter((_, i) => i !== qIndex).map((q, i) => ({ ...q, position: i })));
  }

  function updateQuestionText(qIndex, text) {
    const next = [...questions];
    next[qIndex] = { ...next[qIndex], question_text: text };
    setQuestions(next);
  }

  function addOption(qIndex) {
    const next = [...questions];
    next[qIndex].options = [...next[qIndex].options, { option_text: "", is_correct: false }];
    setQuestions(next);
  }

  function removeOption(qIndex, oIndex) {
    const next = [...questions];
    if (next[qIndex].options.length <= 2) return;
    next[qIndex].options = next[qIndex].options.filter((_, i) => i !== oIndex);
    if (!next[qIndex].options.some((o) => o.is_correct)) {
      next[qIndex].options[0].is_correct = true;
    }
    setQuestions(next);
  }

  function updateOptionText(qIndex, oIndex, text) {
    const next = [...questions];
    next[qIndex].options[oIndex] = { ...next[qIndex].options[oIndex], option_text: text };
    setQuestions(next);
  }

  function setCorrectOption(qIndex, oIndex) {
    const next = [...questions];
    next[qIndex].options = next[qIndex].options.map((o, i) => ({ ...o, is_correct: i === oIndex }));
    setQuestions(next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.put(`/admin/quizzes/${quizId}`, { title, questions });
      router.push(`/admin/courses/${courseId}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this quiz?")) return;
    try {
      await api.del(`/admin/quizzes/${quizId}`);
      router.push(`/admin/courses/${courseId}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {courseId && <a href={`/admin/courses/${courseId}`} className="text-blue-600 text-sm">← Back to course</a>}
      <h1 className="text-2xl font-bold">Edit Quiz</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Quiz title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white p-4 rounded-lg shadow space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Question {qIndex + 1}</span>
              {questions.length > 1 && (
                <button type="button" className="text-red-600 text-sm" onClick={() => removeQuestion(qIndex)}>
                  Remove question
                </button>
              )}
            </div>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Question text"
              value={q.question_text}
              onChange={(e) => updateQuestionText(qIndex, e.target.value)}
            />
            <div className="space-y-2">
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={opt.is_correct}
                    onChange={() => setCorrectOption(qIndex, oIndex)}
                  />
                  <input
                    className="flex-1 border rounded px-3 py-2"
                    placeholder={`Option ${oIndex + 1}`}
                    value={opt.option_text}
                    onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                  />
                  {q.options.length > 2 && (
                    <button type="button" className="text-red-600 text-sm" onClick={() => removeOption(qIndex, oIndex)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="text-blue-600 text-sm" onClick={() => addOption(qIndex)}>
              + Add option
            </button>
          </div>
        ))}

        <button type="button" className="bg-gray-200 rounded px-4 py-2" onClick={addQuestion}>
          + Add question
        </button>

        <div className="flex gap-2">
          <button className="bg-blue-600 text-white rounded px-4 py-2" type="submit">
            Save Changes
          </button>
          <button type="button" className="bg-red-600 text-white rounded px-4 py-2" onClick={handleDelete}>
            Delete Quiz
          </button>
        </div>
      </form>
    </div>
  );
}
