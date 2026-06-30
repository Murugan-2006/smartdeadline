import React, { useState } from "react";
import { Check, Trash2, Calendar, AlertTriangle, CheckSquare, Square, Mail, Clock, ShieldCheck, Sparkles, MapPin, CheckCircle2, Tag, ExternalLink } from "lucide-react";
import { Task } from "../types";
import { getDistanceInMeters, getServiceTypeForTask, MOCK_PLACES } from "./NearbyServices";

interface TaskListProps {
  tasks: Task[];
  onToggleStatus: (id: string, currentStatus: "pending" | "completed") => void;
  onDelete: (id: string) => void;
  onLocateService?: (type: string, serviceName: string) => void;
  userLocation?: { lat: number; lng: number };
}

const getContextTag = (category: string) => {
  switch (category) {
    case "Medicine":
      return "Pharmacy";
    case "Assignment":
      return "Print Shop";
    case "Registration":
      return "Print Shop";
    case "Bill":
      return "Bank / ATM";
    default:
      return "Print Shop";
  }
};

export default function TaskList({
  tasks,
  onToggleStatus,
  onDelete,
  onLocateService,
  userLocation,
}: TaskListProps) {
  const [expandedEmails, setExpandedEmails] = useState<Record<string, boolean>>({});

  const toggleEmailExpand = (id: string) => {
    setExpandedEmails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Sort tasks: pending first, then sort by priorityScore descending
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }
    return b.priorityScore - a.priorityScore;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Medicine":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "Bill":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "Assignment":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "Interview":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "Registration":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Event":
        return "bg-blue-50 text-blue-700 border-blue-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "gmail":
        return (
          <span className="flex items-center space-x-1 text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded">
            <Mail className="w-2.5 h-2.5" />
            <span>Gmail</span>
          </span>
        );
      case "calendar":
        return (
          <span className="flex items-center space-x-1 text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded">
            <Calendar className="w-2.5 h-2.5" />
            <span>Google Calendar</span>
          </span>
        );
      default:
        return (
          <span className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded font-mono">
            Manual
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-900">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-slate-900" />
          <h2 className="text-xs font-bold tracking-tight uppercase font-mono text-slate-900">
            Intelligent Priority Queue
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {tasks.filter((t) => t.status === "pending").length} Pending
        </span>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-slate-350" />
          <p className="text-sm font-semibold text-slate-800">All caught up!</p>
          <p className="text-xs mt-1 text-slate-400">Your task list is currently empty.</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
          {sortedTasks.map((task) => {
            const isPending = task.status === "pending";

            // Geolocation Auto Matching within 500 meters
            let nearbyMatch: any = null;
            let matchedTypeLabel = "";

            if (isPending && userLocation) {
              const matchedType = getServiceTypeForTask(task.title, task.category);
              if (matchedType) {
                matchedTypeLabel = matchedType;
                // Get all places of this type, calculate high-precision distance
                const matchingPlaces = MOCK_PLACES.filter((p) => p.type === matchedType).map((place) => {
                  const placeLat = 12.8906 + place.latOffset;
                  const placeLng = 80.0412 + place.lngOffset;
                  const dist = getDistanceInMeters(userLocation.lat, userLocation.lng, placeLat, placeLng);
                  return { ...place, dist };
                });

                // Get closest place
                const closest = matchingPlaces.sort((a, b) => a.dist - b.dist)[0];
                if (closest) {
                  nearbyMatch = closest;
                }
              }
            }

            if (task.source === "gmail" && isPending) {
              const daysLeftNum = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const daysLeftStr = daysLeftNum < 0 ? "Expired" : daysLeftNum === 0 ? "Due today" : daysLeftNum === 1 ? "1 days left" : `${daysLeftNum} days left`;
              
              const isCritical = task.priorityScore >= 75;
              const isEmailExpanded = !!expandedEmails[task.id];
              const contextTag = getContextTag(task.category);

              const getCategoryDarkColor = (cat: string) => {
                switch (cat) {
                  case "Medicine":
                    return "bg-rose-500/15 text-rose-400 border-rose-500/25";
                  case "Bill":
                    return "bg-amber-500/15 text-amber-400 border-amber-500/25";
                  case "Assignment":
                    return "bg-purple-500/15 text-purple-400 border-purple-500/25";
                  case "Interview":
                    return "bg-indigo-500/15 text-indigo-400 border-indigo-500/25";
                  case "Registration":
                    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
                  case "Event":
                    return "bg-blue-500/15 text-blue-400 border-blue-500/25";
                  default:
                    return "bg-slate-500/15 text-slate-450 border-slate-500/25";
                }
              };

              return (
                <div
                  key={task.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white relative transition-all duration-200 hover:border-slate-700 shadow-md mb-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${getCategoryDarkColor(task.category)}`}>
                        {task.category}
                      </span>
                      <span className="flex items-center space-x-1 text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-bold uppercase tracking-wider">
                        <Mail className="w-2.5 h-2.5" />
                        <span>Gmail</span>
                      </span>
                    </div>

                    <button
                      onClick={() => onToggleStatus(task.id, task.status)}
                      className="text-slate-400 hover:text-white transition cursor-pointer mr-6"
                      title="Mark Complete"
                    >
                      <Square className="w-5 h-5" />
                    </button>
                  </div>

                  <h3 className="text-base font-bold tracking-tight text-white mb-1">
                    {task.title}
                  </h3>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed mb-3">
                    Organization: <span className="text-slate-200 font-semibold">{task.organization || "Coding Ninjas"}</span>
                    {" | "}
                    <span className="text-slate-400 font-light">Details: Extracted from email: "{task.title.length > 35 ? task.title.substring(0, 35) + '...' : task.title}"</span>
                  </p>

                  <div className="mb-3">
                    <button
                      onClick={() => toggleEmailExpand(task.id)}
                      className="text-[11px] font-extrabold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider flex items-center space-x-1.5 py-1 cursor-pointer select-none"
                    >
                      <span>
                        {isEmailExpanded ? "▲ HIDE FULL EMAIL" : "▼ VIEW FULL EMAIL"}
                      </span>
                    </button>
                  </div>

                  {isEmailExpanded && (
                    <div className="bg-slate-950 text-slate-300 font-mono text-xs p-4 rounded-lg border border-slate-800 max-h-52 overflow-y-auto leading-relaxed mb-4 select-text">
                      <pre className="whitespace-pre-wrap font-sans text-xs">
                        {task.fullEmailBody || task.description}
                      </pre>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2 pt-2 border-t border-slate-800">
                    <div className="flex flex-wrap gap-2">
                      <span className="flex items-center space-x-1 bg-slate-800/80 border border-slate-700/50 text-slate-300 px-2.5 py-1 rounded-md text-xs font-mono font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-450" />
                        <span>{daysLeftStr}</span>
                      </span>

                      {isCritical && (
                        <span className="bg-rose-600 border border-rose-500 text-white px-2.5 py-1 rounded-md text-xs font-bold tracking-wider font-sans uppercase shadow-sm">
                          CRITICAL
                        </span>
                      )}

                      <span className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700/50 text-slate-300 px-2.5 py-1 rounded-md text-xs font-mono font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>{task.riskScore || 10}% risk</span>
                      </span>

                      <span className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md text-xs font-medium">
                        <Tag className="w-3.5 h-3.5 text-amber-450" />
                        <span>{contextTag}</span>
                      </span>
                    </div>

                    {task.actionUrl && (
                      <button
                        onClick={() => window.open(task.actionUrl, "_blank")}
                        className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition duration-150 flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                        <span>{task.actionLabel || "SUBMIT NOW"}</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onDelete(task.id)}
                    title="Remove Task"
                    className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 p-1 hover:bg-slate-800 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={task.id}
                className={`p-4 rounded-lg border transition duration-150 relative ${
                  isPending
                    ? "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/20"
                    : "bg-slate-50/50 border-slate-100 opacity-60 hover:opacity-80"
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  {/* Status Toggle Box */}
                  <button
                    onClick={() => onToggleStatus(task.id, task.status)}
                    className="mt-1 text-slate-300 hover:text-slate-900 transition cursor-pointer"
                  >
                    {!isPending ? (
                      <CheckSquare className="w-5 h-5 text-slate-900" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  {/* Details */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {/* Category Tag */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getCategoryColor(task.category)}`}>
                        {task.category}
                      </span>

                      {/* Priority Score Progress indicator */}
                      {isPending && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center space-x-1 border ${
                          task.priorityScore >= 75
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : task.priorityScore >= 40
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          <Sparkles className="w-2.5 h-2.5 text-slate-500" />
                          <span>P-Score: {task.priorityScore}</span>
                        </span>
                      )}

                      {/* Source */}
                      {getSourceBadge(task.source)}

                      {/* Distance Constraint Indicator Badge */}
                      {nearbyMatch && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          nearbyMatch.dist <= 500
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}>
                          📍 {nearbyMatch.dist <= 500 ? `Nearby Matched (${nearbyMatch.dist}m)` : `Too Far (${nearbyMatch.dist}m)`}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className={`text-sm font-semibold tracking-tight ${
                      isPending ? "text-slate-900" : "text-slate-400 line-through"
                    }`}>
                      {task.title}
                    </h3>

                    {/* Description */}
                    {task.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Meta info (Due Date, Duration) */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-450" />
                        <span>
                          {new Date(task.dueDate).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>

                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-450" />
                        <span>Est: {task.estimatedTime}m</span>
                      </span>
                    </div>

                    {/* AUTOMATED GEOLOCATION ACTION PANELS */}
                    {isPending && nearbyMatch && (
                      <div className="mt-3">
                        {nearbyMatch.dist <= 500 ? (
                          // Green Active Match within 500 meters
                          <div className="p-3 bg-emerald-50/75 border border-emerald-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
                            <div className="flex items-start space-x-2">
                              <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide font-mono">
                                  Auto Geofence Scan Match!
                                </span>
                                <p className="text-xs text-emerald-950 font-medium">
                                  {nearbyMatch.name} is only <strong className="text-emerald-700 font-extrabold">{nearbyMatch.dist}m</strong> away.
                                </p>
                                <p className="text-[9.5px] text-emerald-650 truncate font-mono">
                                  {nearbyMatch.address}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => onToggleStatus(task.id, "pending")}
                              className="self-start sm:self-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold font-mono transition cursor-pointer flex items-center space-x-1 shadow-sm shrink-0"
                            >
                              <Check className="w-3 h-3" />
                              <span>Arrive & Check-Off</span>
                            </button>
                          </div>
                        ) : (
                          // Gray Out-of-Range Match exceeding 500 meters
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-2 opacity-75">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide font-mono">
                                Location Scan Result Exceeds 500m Limit
                              </div>
                              <p className="text-[11px] text-slate-600">
                                Nearest match <strong className="text-slate-700">{nearbyMatch.name}</strong> is {nearbyMatch.dist}m away.
                              </p>
                              <span className="text-[9px] text-rose-500 font-mono">
                                ✕ Exceeds automatic background scan threshold (500m).
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => onDelete(task.id)}
                  title="Remove Task"
                  className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-100 rounded transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
