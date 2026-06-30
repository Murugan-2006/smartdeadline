import React from "react";
import { Clock, BookOpen, AlertCircle, RefreshCw, Star, CheckSquare } from "lucide-react";
import { DailyPlan } from "../types";

interface ScheduleAssistantProps {
  plan: DailyPlan | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function ScheduleAssistant({ plan, onRefresh, isLoading }: ScheduleAssistantProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 text-slate-900 shadow-sm h-full">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-slate-900" />
          <h2 className="text-xs font-bold tracking-tight uppercase font-mono text-slate-900">
            AI Scheduling Assistant
          </h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-slate-900 transition cursor-pointer disabled:opacity-50"
          title="Regenerate daily plan with AI"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="flex items-center justify-center space-x-1.5 mb-2.5">
            <span className="w-2 h-2 bg-slate-900 rounded-full animate-bounce delay-0" />
            <span className="w-2 h-2 bg-slate-900 rounded-full animate-bounce delay-150" />
            <span className="w-2 h-2 bg-slate-900 rounded-full animate-bounce delay-300" />
          </div>
          <p className="text-xs font-mono text-slate-400">Gemini organizing optimal day schedule...</p>
        </div>
      ) : !plan || plan.schedule.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Clock className="w-8 h-8 mx-auto mb-3 text-slate-200" />
          <p className="text-xs">No active plans today.</p>
          <p className="text-[10px] mt-1 text-slate-400">Sync with Gmail or add tasks to draft an AI itinerary.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Schedule Agenda Timeline */}
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono">
                Today&apos;s Conflict-Free Schedule
              </h3>
              {plan.isAiGenerated === false && (
                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase font-mono tracking-wide">
                  Heuristic Priority Mode
                </span>
              )}
            </div>
            <div className="border-l-2 border-slate-200 pl-4 space-y-4">
              {plan.schedule.map((item, index) => (
                <div key={index} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-900 border border-white group-hover:scale-125 transition" />

                  <div>
                    <span className="text-[10px] text-slate-500 font-mono font-semibold">
                      {item.time}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800 mt-0.5 leading-tight">
                      {item.taskTitle}
                    </h4>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Estimated Duration: {item.duration} minutes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights & Recommendations */}
          {plan.insights && plan.insights.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5">
                <Star className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>AI Productivity Insights</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed pl-1.5">
                {plan.insights.map((insight, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-slate-900 select-none font-bold shrink-0">›</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
