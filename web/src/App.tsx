import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AccountInfoDialog } from "@/components/AccountInfoDialog";
import { UploadDialog } from "@/components/UploadDialog";
import Transactions from "./pages/Transactions";
import Rules from "./pages/Rules";
import Settings from "./pages/Settings";
import Visualization from "./pages/Visualization";
import Categorize from "./pages/Categorize";

const nav = [
  ["/", "Transactions"],
  ["/visualize", "Visualize"],
  ["/categorize", "Categorize"],
  ["/rules", "Rules"],
  ["/settings", "Settings"],
] as const;

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <header className="border-b">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 p-4">
              <span className="font-bold">Vibe Badget</span>
              {nav.map(([to, label]) => (
                <NavLink key={to} to={to} end className={({ isActive }) =>
                  isActive ? "font-medium underline" : "text-muted-foreground"}>
                  {label}
                </NavLink>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <AccountInfoDialog />
                <ThemeToggle />
                <UploadDialog />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl p-4">
            <Routes>
              <Route path="/" element={<Transactions />} />
              <Route path="/visualize" element={<Visualization />} />
              <Route path="/categorize" element={<Categorize />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
          <Toaster />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
