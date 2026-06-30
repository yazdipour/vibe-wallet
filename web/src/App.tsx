import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Upload from "./pages/Upload";
import Transactions from "./pages/Transactions";
import Rules from "./pages/Rules";
import Settings from "./pages/Settings";
import Visualization from "./pages/Visualization";
import Categorize from "./pages/Categorize";

const nav = [
  ["/", "Transactions"],
  ["/visualize", "Visualize"],
  ["/upload", "Upload"],
  ["/categorize", "Categorize"],
  ["/rules", "Rules"],
  ["/settings", "Settings"],
] as const;

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b">
          <nav className="mx-auto flex max-w-5xl gap-4 p-4">
            <span className="font-bold">Vibe Badget</span>
            {nav.map(([to, label]) => (
              <NavLink key={to} to={to} end className={({ isActive }) =>
                isActive ? "font-medium underline" : "text-muted-foreground"}>
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-4">
          <Routes>
            <Route path="/" element={<Transactions />} />
            <Route path="/visualize" element={<Visualization />} />
            <Route path="/categorize" element={<Categorize />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </BrowserRouter>
  );
}
