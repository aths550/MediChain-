import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Landing from "./pages/Landing.jsx";
import Scan from "./pages/Scan.jsx";
import Verify from "./pages/Verify.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Demo from "./pages/Demo.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 hero-gradient">
      <Navbar />
      <Routes>
        <Route path="/"             element={<Landing />} />
        <Route path="/scan"         element={<Scan />} />
        <Route path="/verify/:batchId" element={<Verify />} />
        <Route path="/dashboard"    element={<Dashboard />} />
        <Route path="/demo"         element={<Demo />} />
        <Route path="*"             element={<NotFound />} />
      </Routes>
    </div>
  );
}
