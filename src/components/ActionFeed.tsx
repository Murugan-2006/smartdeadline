import React from "react";
import { AlertCircle, MapPin, Zap, Bell, CheckCircle, Clock } from "lucide-react";
import { ActionRecommendation } from "../types";

interface ActionFeedProps {
  recommendations: ActionRecommendation[];
  onDismiss: (id: string) => void;
  onLocateService?: (type: string, serviceName: string) => void;
}

export default function ActionFeed({
  recommendations,
  onDismiss,
  onLocateService,
}: ActionFeedProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-900">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-slate-900" />
          <h2 className="text-xs font-bold tracking-tight uppercase font-mono text-slate-900">
            Action Intelligence Feed
          </h2>
        </div>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200/60">
          Live Insights
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Your intelligence feed is clear.</p>
          <p className="text-[10px] mt-1 text-slate-400">Scan emails or add tasks to trigger proactive tips.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`p-3.5 rounded-lg border flex items-start space-x-3 transition hover:bg-slate-50/50 relative group ${
                rec.type === "urgency_alert"
                  ? "bg-rose-50/50 border-rose-100 text-rose-950"
                  : rec.type === "nearby_service"
                  ? "bg-emerald-50/40 border-emerald-100 text-emerald-950"
                  : rec.type === "calendar_conflict"
                  ? "bg-amber-50/40 border-amber-100 text-amber-950"
                  : "bg-slate-50/80 border-slate-250/60"
              }`}
            >
              {/* Type Icon */}
              <div className="mt-0.5 shrink-0">
                {rec.type === "urgency_alert" ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : rec.type === "nearby_service" ? (
                  <MapPin className="w-4 h-4 text-emerald-600" />
                ) : rec.type === "calendar_conflict" ? (
                  <Clock className="w-4 h-4 text-amber-600" />
                ) : (
                  <Bell className="w-4 h-4 text-slate-500" />
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-800 leading-relaxed font-sans font-medium">
                  {rec.message}
                </p>

                {/* Sub-actions for Services */}
                {rec.type === "nearby_service" && rec.metadata?.serviceType && (
                  <button
                    onClick={() =>
                      onLocateService &&
                      onLocateService(
                        rec.metadata?.serviceType || "pharmacy",
                        rec.metadata?.serviceName || "Pharmacy"
                      )
                    }
                    className="mt-2 inline-flex items-center space-x-1 text-[10px] text-slate-900 hover:text-black font-semibold underline transition cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Find & view nearest options</span>
                  </button>
                )}

                <div className="mt-1.5 flex items-center space-x-2">
                  <span className="text-[9px] text-slate-400 font-mono">
                    {new Date(rec.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => onDismiss(rec.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition text-[10px] p-1 hover:bg-slate-100 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
