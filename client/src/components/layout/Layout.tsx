import React, { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuth } from "../../context/AuthContext";
import { canAccessPath } from "./navigation";

export const Layout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="admin-shell flex min-h-screen bg-[#f8fafc] text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        isOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      />
      <div
        className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ${
          sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[272px]"
        }`}
      >
        <Navbar onToggleSidebar={() => setSidebarOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-2.5 sm:px-6 sm:py-3 xl:px-8 xl:py-3">
          <div className="admin-page">
            {canAccessPath(location.pathname, user?.role, user?.builderAccess) ? <Outlet /> : <Navigate to="/" replace />}
          </div>
        </main>
      </div>
    </div>
  );
};
