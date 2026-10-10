import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Store,
  X,
  Boxes,
} from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { canSeeNavigationItem, navigationGroups } from "./navigation";

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  collapsed,
  onClose,
  onToggleCollapsed,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const [storeConnected, setStoreConnected] = React.useState<boolean | null>(null);
  const storefrontUrl = (import.meta as any).env?.VITE_STOREFRONT_URL || "http://localhost:3001";

  React.useEffect(() => {
    api.get("/storefront/settings")
      .then(() => setStoreConnected(true))
      .catch(() => setStoreConnected(false));
  }, []);

  return (
    <>
      {/* Mobile backdrop */}
      <button
        aria-label="Close navigation"
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Main Sidebar */}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-slate-200/80 bg-white text-slate-700 shadow-xl transition-[width,transform] duration-300 lg:z-20 lg:translate-x-0 lg:shadow-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 ${
          collapsed ? "w-[76px]" : "w-[260px]"
        } ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:flex`}
      >
        {/* Header with Logo and Collapse Toggle */}
        <div
          className={`flex h-16 items-center border-b border-slate-100 px-4 dark:border-slate-800/80 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2.5"
            onClick={onClose}
            aria-label="NIX Commerce home"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-sm shadow-emerald-500/20">
              N
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  NIX Commerce
                </p>
                <p className="truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  Operations workspace
                </p>
              </div>
            )}
          </NavLink>

          {/* Desktop collapse button at top next to logo */}
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:flex dark:hover:bg-slate-800 dark:hover:text-white"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {/* Mobile close button */}
          {!collapsed && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsed top expand button */}
        {collapsed && (
          <div className="hidden border-b border-slate-100 py-2 text-center lg:block dark:border-slate-800">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {navigationGroups.map((group, groupIndex) => {
            const visibleItems = group.items.filter((item) =>
              canSeeNavigationItem(item, user?.role, user?.builderAccess),
            );
            if (!visibleItems.length) return null;

            return (
              <div key={group.label} className={groupIndex ? "mt-5" : ""}>
                {!collapsed && (
                  <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const itemActive =
                      location.pathname === item.path ||
                      Boolean(item.children?.some((child) => location.pathname === child.path));

                    return (
                      <div key={item.path}>
                        <NavLink
                          to={item.children?.length ? (item.children.find((child) => !child.roles || (user && child.roles.includes(user.role)))?.path || item.path) : item.path}
                          title={collapsed ? item.label : undefined}
                          onClick={onClose}
                          className={() =>
                            `group flex items-center rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                              collapsed ? "justify-center" : "gap-2.5"
                            } ${
                              itemActive
                                ? "bg-slate-100 font-semibold text-slate-900 shadow-none dark:bg-slate-800 dark:text-white"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white"
                            }`
                          }
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              itemActive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                            }`}
                            strokeWidth={2}
                          />
                          {!collapsed && (
                            <>
                              <span className="truncate">{item.label}</span>
                              {item.children?.length ? (
                                <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-40" />
                              ) : null}
                            </>
                          )}
                        </NavLink>

                        {/* Submenu items */}
                        {!collapsed && item.children?.length && itemActive && (
                          <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-800">
                            {item.children.filter((child) => !child.roles || (user && child.roles.includes(user.role))).map((child) => (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                onClick={onClose}
                                className={({ isActive }) =>
                                  `block rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                                    isActive
                                      ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-white"
                                  }`
                                }
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Link to Storefront */}
        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          {!collapsed && (
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-2.5 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Store className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Storefront <ExternalLink className="h-3 w-3 opacity-40" />
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <i
                    className={`h-1.5 w-1.5 rounded-full ${
                      storeConnected === true
                        ? "bg-emerald-500"
                        : storeConnected === false
                        ? "bg-rose-400"
                        : "bg-amber-300"
                    }`}
                  />
                  {storeConnected === true ? "Connected" : "Disconnected"}
                </span>
              </span>
            </a>
          )}
        </div>
      </aside>
    </>
  );
};
