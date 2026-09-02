"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResetToken("");
    setLoading(true);
    try {
      const data = await forgotPassword(email);
      setResetToken(data.reset_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow">
        <h1 className="text-2xl font-semibold mb-6 text-gray-800">Forgot password</h1>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}

        {resetToken ? (
          <div className="mb-4 text-sm bg-teal-50 border border-teal-200 rounded p-3 break-all">
            <p className="text-gray-700 mb-2">
              Since this app has no email service yet, here is your reset token
              (valid 30 minutes):
            </p>
            <code className="text-teal-700">{resetToken}</code>
            <p className="mt-2">
              <Link href="/reset-password" className="text-teal-600 hover:underline">
                Go to reset password page
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white rounded-lg py-2 font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Get reset token"}
            </button>
          </form>
        )}

        <div className="mt-4 text-sm">
          <Link href="/login" className="text-teal-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
