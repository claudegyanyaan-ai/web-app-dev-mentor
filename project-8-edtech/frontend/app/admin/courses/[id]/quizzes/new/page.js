"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../../../lib/api";

function emptyQuestion(position) {
  return {
    question_text: "",
    position,
    options: [
      { option_text: "", is_correct: true },
      { option_text: "", is_correct: false },
    ],
  };
}

export default function NewQuiz() {
  const { id } = useParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([emptyQuestion(0)]);
  const [error, setError] = useState("");

  function addQuestion() {
    setQuestions([...questions, emptyQuestion(questions.length)]);
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
      await api.post(`/admin/courses/${id}/quizzes`, { title, questions });
      router.push(`/admin/courses/${id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <a href={`/admin/courses/${id}`} className="text-blue-600 text-sm">← Back to course</a>
      <h1 className="text-2xl font-bold">New Quiz</h1>
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
            <p className="text-xs text-gray-500">The radio button marks the correct answer.</p>
          </div>
        ))}

        <button type="button" className="bg-gray-200 rounded px-4 py-2" onClick={addQuestion}>
          + Add question
        </button>

        <div>
          <button className="bg-blue-600 text-white rounded px-4 py-2" type="submit">
            Save Quiz
          </button>
        </div>
      </form>
    </div>
  );
}
