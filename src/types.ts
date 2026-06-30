/**
 * Shared Type Definitions for SmartDeadline AI
 */

export type TaskCategory =
  | "Assignment"
  | "Registration"
  | "Interview"
  | "Event"
  | "Bill"
  | "Medicine"
  | "Other";

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  category: TaskCategory;
  status: "pending" | "completed";
  priorityScore: number; // 0 - 100
  priorityLabel: "High" | "Medium" | "Low";
  estimatedTime: number; // in minutes
  location?: string;
  source: "user" | "gmail" | "calendar";
  gmailId?: string;
  calendarEventId?: string;
  createdAt: string;
  updatedAt: string;
  actionUrl?: string;
  actionLabel?: string;
  fullEmailBody?: string;
  organization?: string;
  riskScore?: number;
}

export type RecommendationType =
  | "nearby_service"
  | "urgency_alert"
  | "calendar_conflict"
  | "general";

export interface ActionRecommendation {
  id: string;
  type: RecommendationType;
  message: string;
  timestamp: string;
  relatedTaskId?: string;
  metadata?: {
    distance?: number;
    duration?: number;
    serviceType?: string;
    serviceName?: string;
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
}

export interface NearbyService {
  name: string;
  address: string;
  rating?: number;
  distance: number; // in meters
  duration: number; // in minutes
  type: "pharmacy" | "printer" | "courier" | "government" | "bank";
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface DailyScheduleItem {
  time: string;
  taskId: string;
  taskTitle: string;
  duration: number; // in minutes
}

export interface DailyPlan {
  date: string;
  schedule: DailyScheduleItem[];
  insights: string[];
  isAiGenerated?: boolean;
}
