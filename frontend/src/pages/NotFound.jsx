import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-screen pt-24 px-4 flex items-center justify-center">
      <div className="text-center animate-slide-up">
        <p className="text-8xl font-black text-gradient mb-4">404</p>
        <h1 className="text-2xl font-bold mb-3">Page Not Found</h1>
        <p className="text-white/60 mb-8">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary">← Go Home</Link>
      </div>
    </main>
  );
}
