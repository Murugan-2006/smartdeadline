import React, { useState, useEffect } from "react";
import { Sparkles, Mail, Calendar, MapPin, Zap, Brain, ShieldAlert, CheckCircle2, Clock, Check } from "lucide-react";
import Navbar from "./components/Navbar";
import ActionFeed from "./components/ActionFeed";
import TaskForm from "./components/TaskForm";
import TaskList from "./components/TaskList";
import ScheduleAssistant from "./components/ScheduleAssistant";
import NearbyServices from "./components/NearbyServices";
import { Task, ActionRecommendation, DailyPlan } from "./types";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [recommendations, setRecommendations] = useState<ActionRecommendation[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);

  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  const [selectedLocateType, setSelectedLocateType] = useState<string>("pharmacy");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({
    lat: 12.8906, // Default: Chennai Institute of Technology center
    lng: 80.0412,
  });
  const [locationPreset, setLocationPreset] = useState<string>("cit");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  // Helper to trigger temporary feedback toast
  const showToast = (message: string, type: "success" | "info" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Fetch status on mount
  const checkAuthStatus = async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
      setUser(data.user);
    } catch (e) {
      console.error("Auth status check failed:", e);
    }
  };

  // Fetch data helpers
  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const list = await res.json();
      setTasks(list);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await fetch("/api/ai/feed");
      const list = await res.json();
      setRecommendations(list);
    } catch (e) {
      console.error("Failed to fetch feed:", e);
    }
  };

  const fetchSchedulePlan = async () => {
    setIsLoadingSchedule(true);
    try {
      const res = await fetch("/api/ai/schedule");
      const plan = await res.json();
      setDailyPlan(plan);
    } catch (e) {
      console.error("Failed to fetch AI schedule:", e);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  // Combined fetch on initialization or auth sync
  const loadDashboardData = async () => {
    await Promise.all([fetchTasks(), fetchRecommendations(), fetchSchedulePlan()]);
  };

  useEffect(() => {
    checkAuthStatus();
    loadDashboardData();
  }, []);

  // Listen for login popup window results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      // Allow safety checks for local development or sandbox domains
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        setIsAuthenticated(true);
        setUser(event.data.user);
        showToast(`Connected successfully as ${event.data.user.name}!`, "success");
        loadDashboardData();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 1. Authentication Handlers
  const handleLogin = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      const { url } = await res.json();

      if (!url) {
        showToast("Backend Google OAuth client is unconfigured. Verify Client ID environment settings.", "error");
        return;
      }

      const authWindow = window.open(url, "google_oauth_popup", "width=600,height=750");
      if (!authWindow) {
        showToast("OAuth Popup was blocked by your browser. Please enable popups to connect Gmail & Calendar.", "info");
      }
    } catch (err) {
      showToast("Error getting Google OAuth url.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsAuthenticated(false);
      setUser(null);
      showToast("Disconnected your Google Account.", "info");
      loadDashboardData();
    } catch (err) {
      showToast("Logout failed.", "error");
    }
  };

  // 2. Synchronization Handlers
  const handleSyncGmail = async () => {
    if (!isAuthenticated) {
      showToast("Please connect your Google Account first to scan Gmail.", "info");
      return;
    }

    setIsSyncingGmail(true);
    showToast("Scanning your Gmail for assignment submissions, bill invoices, and medicine visit deadlines...", "info");

    try {
      const res = await fetch("/api/sync/gmail", { method: "POST" });
      const result = await res.json();

      if (res.ok) {
        showToast(
          `Scan Complete! Scanned ${result.scannedCount} emails, auto-extracted & prioritized ${result.addedCount} task(s).`,
          result.addedCount > 0 ? "success" : "info"
        );
        loadDashboardData();
      } else {
        showToast(result.error || "Gmail synchronization failed.", "error");
      }
    } catch (err) {
      showToast("Failed to communicate with Gmail scan services.", "error");
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleSyncCalendar = async () => {
    if (!isAuthenticated) {
      showToast("Please connect your Google Account first to sync calendar.", "info");
      return;
    }

    setIsSyncingCalendar(true);
    showToast("Synchronizing with your Google Calendar...", "info");

    try {
      const res = await fetch("/api/sync/calendar", { method: "POST" });
      const result = await res.json();

      if (res.ok) {
        showToast(
          `Sync Complete! Pulled ${result.syncedFromCalendar} new events into assistant and synchronized ${result.syncedToCalendar} manual tasks to your Google Calendar schedule.`,
          "success"
        );
        loadDashboardData();
      } else {
        showToast(result.error || "Google Calendar sync failed.", "error");
      }
    } catch (err) {
      showToast("Failed to communicate with Google Calendar service.", "error");
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  // 3. Task Management Handlers
  const handleAddTask = async (task: any) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });

    if (res.ok) {
      showToast(`Task "${task.title}" added and priority analyzed with AI!`, "success");
      loadDashboardData();
    } else {
      const err = await res.json();
      throw new Error(err.error || "Failed to create task");
    }
  };

  const handleToggleTaskStatus = async (id: string, currentStatus: "pending" | "completed") => {
    const nextStatus = currentStatus === "pending" ? "completed" : "pending";
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        showToast(nextStatus === "completed" ? "Task completed! Great job!" : "Task moved back to pending list.", "success");
        loadDashboardData();
      }
    } catch (e) {
      showToast("Failed to update task status.", "error");
    }
  };

  const handleDeleteTask = async (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this task commitment?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Task commitment permanently removed.", "info");
        loadDashboardData();
      }
    } catch (e) {
      showToast("Failed to delete task.", "error");
    }
  };

  // 4. Voice command handler
  const handleVoiceCommand = async (commandText: string) => {
    const res = await fetch("/api/ai/voice-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: commandText }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`AI extracted & added task: "${data.task.title}" (${data.task.category})`, "success");
      loadDashboardData();
    }
    return data;
  };

  // 5. Locate service click (switches map tab and scrolls down)
  const handleLocateService = (type: string, serviceName: string) => {
    setSelectedLocateType(type);
    showToast(`Radar set to locate nearby "${serviceName}" services.`, "info");
    const element = document.getElementById("nearby-services-panel");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // 6. Dismiss feed notification
  const handleDismissRecommendation = async (id: string) => {
    // Keep client-side filter responsive
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  };

  // 7. Simulated Arrive Near Service action
  const handleArriveNearService = async (serviceName: string) => {
    // Find any pending medicine tasks when arriving at pharmacy, or banks tasks etc
    let matchedCategory = "Medicine";
    if (selectedLocateType === "printer") matchedCategory = "Assignment";
    else if (selectedLocateType === "bank") matchedCategory = "Bill";
    else if (selectedLocateType === "courier") matchedCategory = "Other";

    const relevantTasks = tasks.filter((t) => t.status === "pending" && t.category === matchedCategory);

    if (relevantTasks.length > 0) {
      // Complete first relevant task automatically
      const targetTask = relevantTasks[0];
      await handleToggleTaskStatus(targetTask.id, "pending");
      showToast(`Arrived near "${serviceName}"! Automatically completed and checked off: "${targetTask.title}"`, "success");
    } else {
      showToast(`Arrived near "${serviceName}". No active pending "${matchedCategory}" tasks found in your priority queue.`, "info");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-black selection:text-white pb-12">
      {/* Dynamic Toast Feedback Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl border shadow-xl max-w-sm flex items-start space-x-3 transition-all duration-300 animate-slide-in bg-white text-slate-900 border-slate-250">
          <div className="mt-0.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-slate-900" />
            ) : toast.type === "error" ? (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            ) : (
              <Zap className="w-5 h-5 text-slate-600 animate-pulse" />
            )}
          </div>
          <div className="flex-1 text-xs font-medium leading-relaxed">
            {toast.message}
          </div>
        </div>
      )}

      {/* Navbar header */}
      <Navbar
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSyncGmail={handleSyncGmail}
        onSyncCalendar={handleSyncCalendar}
        isSyncingGmail={isSyncingGmail}
        isSyncingCalendar={isSyncingCalendar}
        isAuthenticated={isAuthenticated}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Intro Info Banner if not logged in */}
        {!isAuthenticated && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 relative overflow-hidden shadow-sm">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Welcome to SmartDeadline AI
                </span>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Intelligent Task Completion Assistant
                </h2>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Go beyond reminders. Connect your Google workspace account to automatically scan Gmail alerts, prioritize last-minute assignment submissions or medicine purchases, and let our AI scheduling assistant organize your day.
                </p>
              </div>
              <button
                onClick={handleLogin}
                className="self-start md:self-auto px-5 py-2.5 bg-black hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition duration-200 cursor-pointer"
              >
                Connect Gmail & Calendar
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Top Bento Grid: Feed, Creator, AI Assistant */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Creators Column */}
          <div className="space-y-6">
            <TaskForm onAddTask={handleAddTask} onVoiceCommand={handleVoiceCommand} />
            <ActionFeed recommendations={recommendations} onDismiss={handleDismissRecommendation} onLocateService={handleLocateService} />
          </div>

          {/* List and Priority Queue Column */}
          <div className="lg:col-span-2">
            <TaskList
              tasks={tasks}
              onToggleStatus={handleToggleTaskStatus}
              onDelete={handleDeleteTask}
              onLocateService={handleLocateService}
              userLocation={userLocation}
            />
          </div>
        </div>

        {/* Dashboard Mid Bento Grid: Calendar/Agenda Schedule, Maps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* AI Schedule Itinerary Plan */}
          <div>
            <ScheduleAssistant plan={dailyPlan} onRefresh={fetchSchedulePlan} isLoading={isLoadingSchedule} />
          </div>

          {/* Nearby Service discovery & maps panel */}
          <div id="nearby-services-panel" className="lg:col-span-2">
            <NearbyServices
              userLocation={userLocation}
              setUserLocation={setUserLocation}
              locationPreset={locationPreset}
              setLocationPreset={setLocationPreset}
              tasks={tasks}
              onToggleStatus={handleToggleTaskStatus}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

