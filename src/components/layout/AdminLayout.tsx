import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser, logoutUser } from "@/lib/api/users";
import { cn } from "@/lib/utils";
import {
  Bell,
  ChevronDown,
  Compass,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import DHImg from "../../assets/dh.png";

const sidebarGroups = [
  {
    title: "MONITORING",
    links: [{ name: "Dashboard", href: "/admin", icon: Compass }],
  },
  {
    title: "RECRUITMENT",
    links: [
      { name: "Candidates", href: "/admin/candidates", icon: UserCircle },
    ],
  },
  {
    title: "SYSTEM",
    links: [{ name: "Users", href: "/admin/users", icon: Users }],
  },
];

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    }
    return null;
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      try {
        const res = await getCurrentUser();
        if (res.success && res.data) {
          if (res.data.must_change_password) {
            navigate("/change-password?forced=true");
            return;
          }
          setCurrentUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
        }
      } catch (error) {
        console.error("Failed to fetch user", error);
      }
    };
    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Failed to logout on server", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row font-sans transition-colors duration-300 font-light overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 transform transition-all duration-300 ease-in-out md:static flex flex-col",
          sidebarOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full md:translate-x-0",
          sidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-orange-500/5 dark:from-orange-500/10 to-transparent pointer-events-none" />

        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100/50 dark:border-slate-800/50 shrink-0 relative z-10">
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-3",
              sidebarCollapsed && "justify-center px-0",
            )}
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl p-1 flex items-center justify-center w-8 h-8 border border-slate-200/50 dark:border-slate-700/50 shadow-sm shrink-0">
              <img
                src={DHImg}
                alt="DH Logo"
                className="w-full h-full object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-[17px] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                E-Recruitment
              </span>
            )}
          </Link>
          <button
            className="md:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-8 relative z-10">
          {sidebarGroups
            .filter(
              (group) => group.title !== "SYSTEM" || currentUser?.is_admin,
            )
            .map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-2">
                {!sidebarCollapsed && (
                  <h3 className="px-3 text-[10px] font-medium text-slate-400/80 uppercase tracking-widest mb-3 flex items-center gap-4">
                    {group.title}
                    <div className="h-px bg-slate-200/50 dark:bg-slate-800/50 flex-1"></div>
                  </h3>
                )}
                <ul className="space-y-1.5">
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    const isActive =
                      link.href === "/admin"
                        ? location.pathname === "/admin"
                        : location.pathname.startsWith(link.href);

                    return (
                      <li key={link.name}>
                        <Link
                          to={link.href}
                          className={cn(
                            "relative flex items-center gap-3 py-2.5 rounded-xl text-[13px] transition-all group overflow-hidden",
                            sidebarCollapsed ? "px-0 justify-center" : "px-3",
                            isActive
                              ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium shadow-sm shadow-orange-500/5 border border-orange-200/50 dark:border-orange-500/20"
                              : "text-slate-500 dark:text-slate-400 font-normal hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent",
                          )}
                          title={sidebarCollapsed ? link.name : undefined}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1 bottom-1 w-1 bg-orange-500 rounded-r-md" />
                          )}
                          <Icon
                            size={16}
                            className={cn(
                              "transition-transform duration-300 shrink-0",
                              isActive
                                ? "text-orange-600 dark:text-orange-400 scale-110"
                                : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300",
                            )}
                          />
                          {!sidebarCollapsed && <span>{link.name}</span>}

                          {/* Notification Badge Example */}
                          {!sidebarCollapsed &&
                            (link.name === "Applications" ||
                              link.name === "Candidates") &&
                            !isActive && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                            )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </nav>

        {/* Bottom User Card */}
        {!sidebarCollapsed && (
          <div className="p-4 m-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative z-10 group cursor-pointer hover:border-orange-300 dark:hover:border-orange-500/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-sm shrink-0 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                {currentUser?.name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {currentUser?.name || "Administrator"}
                  </p>
                  {currentUser?.is_admin && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 text-[9px] font-bold uppercase tracking-wider border border-orange-200 dark:border-orange-500/20">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                  {currentUser?.email || "admin@ptdh.co.id"}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-30 shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setSidebarOpen(true);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
            >
              <Menu size={24} />
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 outline-none">
                  <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
                    {currentUser?.name?.charAt(0) || "U"}
                  </div>
                  <div className="hidden sm:flex sm:flex-col sm:items-start">
                    <div className="flex gap-2 items-start">
                      <div className="col">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                            {currentUser?.name || "Loading..."}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {currentUser?.email || "Administrator"}
                        </p>
                      </div>
                      <div className="col">
                        {currentUser?.is_admin && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-slate-400 hidden sm:block ml-1"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-sans">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                {/* <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/change-password')} className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator /> */}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/30 dark:focus:text-red-500 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4 text-red-500" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative">
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30 z-0 pointer-events-none"></div>
          <div className="relative z-10 mx-auto min-h-full flex flex-col pb-0">
            <Outlet context={{ currentUser }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
