import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrentUser, type User } from '@/lib/api/users';
import { cn } from '@/lib/utils';
import {
  Bell,
  ChevronDown,
  Compass,
  FileText,
  List,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserCircle,
  Users,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import DHImg from '../../assets/dh.png';

const sidebarGroups = [
  {
    title: 'MONITORING',
    links: [
      { name: 'Dashboard', href: '/admin', icon: Compass },
    ]
  },
  {
    title: 'RECRUITMENT',
    links: [
      { name: 'Jobs', href: '/admin/jobs', icon: List },
      { name: 'Applications', href: '/admin/applications', icon: FileText },
    ]
  },
  {
    title: 'SYSTEM',
    links: [
      { name: 'Users', href: '/admin/users', icon: Users },
    ]
  }
];

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const res = await getCurrentUser();
        if (res.success && res.data) {
          if (res.data.must_change_password) {
            navigate('/change-password?forced=true');
            return;
          }
          setCurrentUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        }
      } catch (error) {
        console.error('Failed to fetch user', error);
      }
    };
    fetchUser();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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
          "fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-all duration-300 ease-in-out md:static flex flex-col",
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
          sidebarCollapsed ? "w-20" : "w-72"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <Link to="/admin" className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center px-0")}>
             <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-1 flex items-center justify-center w-8 h-8 border border-slate-200 dark:border-slate-700 shrink-0">
                <img src={DHImg} alt="DH Logo" className="w-full h-full object-contain" />
             </div>
             {!sidebarCollapsed && <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">E-Recruitment</span>}
          </Link>
          <button
            className="md:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
          {sidebarGroups
            .filter(group => group.title !== 'SYSTEM' || (currentUser?.roles?.includes('Admin') && !currentUser?.roles?.some(r => r.toLowerCase() === 'hr')))
            .map((group, groupIdx) => (
            <div key={groupIdx}>
              {!sidebarCollapsed && (
                <h3 className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  {group.title}
                </h3>
              )}
              <ul className="space-y-1">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = link.href === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname.startsWith(link.href);

                  return (
                    <li key={link.name}>
                      <Link
                        to={link.href}
                        className={cn(
                          "relative flex items-center gap-3 py-3 rounded-xl font-semibold transition-all group overflow-hidden",
                          sidebarCollapsed ? "px-0 justify-center" : "px-4",
                          isActive
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                        title={sidebarCollapsed ? link.name : undefined}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 bg-slate-900 dark:bg-slate-100 rounded-r-md" />
                        )}
                        <Icon size={20} className={cn(
                          "transition-colors shrink-0",
                          isActive ? "text-slate-900 dark:text-white" : "text-slate-400 group-hover:text-slate-500"
                        )} />
                        {!sidebarCollapsed && <span>{link.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
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
                    {currentUser?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">{currentUser?.name || 'Loading...'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser?.roles?.join(', ') || 'User'}</p>
                  </div>
                  <ChevronDown size={16} className="text-slate-400 hidden sm:block ml-1" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-sans">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/change-password')} className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/30 dark:focus:text-red-500 cursor-pointer">
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
          <div className="relative z-10 max-w-6xl mx-auto min-h-full flex flex-col pb-0">
            <Outlet context={{ currentUser }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
