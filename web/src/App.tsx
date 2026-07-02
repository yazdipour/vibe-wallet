import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import {
  Wallet, Receipt, BarChart3, Tags, ListChecks, Settings as SettingsIcon,
} from "lucide-react";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AccountInfoDialog } from "@/components/AccountInfoDialog";
import Transactions from "./pages/Transactions";
import Rules from "./pages/Rules";
import Settings from "./pages/Settings";
import Visualization from "./pages/Visualization";
import Categorize from "./pages/Categorize";

const nav = [
  ["/", "Transactions", Receipt],
  ["/visualize", "Visualize", BarChart3],
  ["/categorize", "Categorize", Tags],
  ["/rules", "Rules", ListChecks],
] as const;

function AppSidebar() {
  const location = useLocation();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 font-bold">
          <Wallet size={18} />
          <span className="group-data-[collapsible=icon]:hidden">Vibe Badget</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {nav.map(([to, label, Icon]) => (
            <SidebarMenuItem key={to}>
              <SidebarMenuButton
                render={<NavLink to={to} end />}
                isActive={to === "/" ? location.pathname === "/" : location.pathname.startsWith(to)}
                tooltip={label}
              >
                <Icon size={16} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<NavLink to="/settings" />}
              isActive={location.pathname === "/settings"}
              tooltip="Settings"
            >
              <SettingsIcon size={16} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex items-center gap-2 border-b p-4">
              <SidebarTrigger />
              <div className="ml-auto">
                <AccountInfoDialog />
              </div>
            </header>
            <main className="mx-auto w-full max-w-5xl p-4">
              <Routes>
                <Route path="/" element={<Transactions />} />
                <Route path="/visualize" element={<Visualization />} />
                <Route path="/categorize" element={<Categorize />} />
                <Route path="/rules" element={<Rules />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}
