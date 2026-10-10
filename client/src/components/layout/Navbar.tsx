import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { io } from "socket.io-client";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { IconButton } from "../ui/IconButton";
import { pageTitleForPath } from "./navigation";

interface NavbarProps {
  onToggleSidebar: () => void;
}

type Alert = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
};

const avatarTone = (name = "") =>
  ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4"][name.length % 5];

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [alerts, setAlerts] = useState<Alert[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("nix-admin-alerts") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "nix-admin-alerts",
      JSON.stringify(alerts.slice(0, 30)),
    );
  }, [alerts]);

  useEffect(() => {
    const socket = io();
    socket.on(
      "order:new",
      (order: {
        id: string;
        orderNumber: string;
        customerName: string;
        grandTotal: number;
      }) =>
        setAlerts((current) =>
          [
            {
              id: `order-${order.id}-${Date.now()}`,
              title: `New order ${order.orderNumber}`,
              detail: `${order.customerName} · ৳${order.grandTotal}`,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...current,
          ].slice(0, 30),
        ),
    );
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const unread = alerts.filter((alert) => !alert.read).length;
  const markRead = () =>
    setAlerts((current) => current.map((alert) => ({ ...alert, read: true })));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/orders?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const currentTitle = pageTitleForPath(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">
      {/* Left side: Mobile Toggle & Desktop Search or Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label="Open navigation"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </IconButton>

        {/* Page Title */}
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {currentTitle}
        </span>
      </div>

      {/* Right side: Theme, Alerts, User Profile */}
      <div className="flex items-center gap-2">
        {/* Theme switcher */}
        <IconButton
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-500" />
          ) : (
            <Moon className="h-4 w-4 text-slate-500" />
          )}
        </IconButton>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={notificationOpen}
            onClick={() => {
              setNotificationOpen((current) => !current);
              setProfileOpen(false);
            }}
            className="relative grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {notificationOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div>
                  <b className="text-xs font-bold text-slate-900 dark:text-white">
                    Notifications
                  </b>
                  <p className="text-[10px] text-slate-400">
                    Real-time order events
                  </p>
                </div>
                {unread > 0 && (
                  <button
                    onClick={markRead}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => {
                        setAlerts((current) =>
                          current.map((item) =>
                            item.id === alert.id ? { ...item, read: true } : item,
                          ),
                        );
                        navigate("/orders");
                        setNotificationOpen(false);
                      }}
                      className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-800/40 ${
                        alert.read ? "opacity-60" : ""
                      }`}
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          alert.read ? "bg-slate-300 dark:bg-slate-600" : "bg-emerald-500"
                        }`}
                      />
                      <span className="min-w-0">
                        <b className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {alert.title}
                        </b>
                        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {alert.detail}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-slate-400">
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    No new notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((current) => !current);
              setNotificationOpen(false);
            }}
            className="flex items-center gap-2 rounded-full p-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-expanded={profileOpen}
          >
            {user?.avatar && !avatarBroken ? (
              <img
                src={user.avatar}
                alt=""
                onError={() => setAvatarBroken(true)}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              />
            ) : (
              <div
                className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white shadow-sm"
                style={{ background: avatarTone(user?.name) }}
              >
                {user?.name?.slice(0, 1).toUpperCase() || "U"}
              </div>
            )}
            <div className="hidden text-left lg:block">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                {user?.name || "Admin"}
              </p>
              <p className="truncate text-[10px] text-slate-400">
                {user?.role?.replace("_", " ") || "Staff"}
              </p>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {user?.name}
                </p>
                <p className="truncate text-[10px] text-slate-400">
                  {user?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigate("/settings");
                  setProfileOpen(false);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Settings2 className="h-3.5 w-3.5 text-slate-400" />
                Settings
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
