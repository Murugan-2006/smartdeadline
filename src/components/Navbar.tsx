import React from "react";
import { Mail, Calendar, LogOut, CheckCircle2, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

interface NavbarProps {
  user: any;
  onLogin: () => void;
  onLogout: () => void;
  onSyncGmail: () => void;
  onSyncCalendar: () => void;
  isSyncingGmail: boolean;
  isSyncingCalendar: boolean;
  isAuthenticated: boolean;
}

export default function Navbar({
  user,
  onLogin,
  onLogout,
  onSyncGmail,
  onSyncCalendar,
  isSyncingGmail,
  isSyncingCalendar,
  isAuthenticated,
}: NavbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white text-slate-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 font-sans">
              SmartDeadline <span className="text-slate-500">AI</span>
            </h1>
            <p className="text-[10px] text-slate-450 uppercase tracking-wider hidden sm:block font-mono font-medium text-slate-400">
              Proactive Task Completion Assistant
            </p>
          </div>
        </div>

        {/* Sync Controls & Auth */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              {/* Gmail Sync Button */}
              <button
                onClick={onSyncGmail}
                disabled={isSyncingGmail}
                title="Scan Gmail for deadlines"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-md text-xs font-medium border border-slate-200 transition disabled:opacity-50 cursor-pointer"
              >
                <Mail className={`w-3.5 h-3.5 text-slate-500 ${isSyncingGmail ? "animate-spin" : ""}`} />
                <span className="hidden md:inline">Scan Gmail</span>
              </button>

              {/* Calendar Sync Button */}
              <button
                onClick={onSyncCalendar}
                disabled={isSyncingCalendar}
                title="Sync Google Calendar events"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-md text-xs font-medium border border-slate-200 transition disabled:opacity-50 cursor-pointer"
              >
                <Calendar className={`w-3.5 h-3.5 text-slate-500 ${isSyncingCalendar ? "animate-spin" : ""}`} />
                <span className="hidden md:inline">Sync Calendar</span>
              </button>

              {/* User profile details */}
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
                <img
                  src={user?.picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                  alt={user?.name || "User profile"}
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-medium text-slate-800 max-w-[120px] truncate">
                    {user?.name || "Connected"}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  title="Disconnect Google Account"
                  className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center space-x-2 px-4 py-2 bg-black hover:bg-slate-800 text-white font-medium rounded-md text-xs transition duration-200 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Connect Google Account</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
