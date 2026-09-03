"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup, login } from "../../lib/api";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await signup(email, password);
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError("Signup failed — that email may already be registered.");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-zinc-900">Sign Up</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-zinc-300 rounded px-3 py-2 mb-4 text-zinc-900"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-zinc-300 rounded px-3 py-2 mb-4 text-zinc-900"
          required
        />
        <button type="submit" className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700">
          Sign Up
        </button>
        <p className="mt-4 text-center text-sm text-zinc-600">
          Already have an account? <a href="/login" className="text-teal-600 hover:underline">Log in</a>
        </p>
      </form>
    </div>
  );
}