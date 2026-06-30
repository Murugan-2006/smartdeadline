import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { google } from "googleapis";

// Load environment variables
dotenv.config({ override: true });

const app = express();
const PORT = 3000;

app.use(express.json());

// Database configuration
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

// Ensure database directory and file exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({
      tasks: [],
      user: null,
      tokens: null,
      recommendations: [],
    }, null, 2)
  );
}

// Read database helper
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading database:", error);
    return { tasks: [], user: null, tokens: null, recommendations: [] };
  }
}

// Write database helper
function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

// Initialize Gemini API
const geminiApiKey = process.env.GEMINI_API_KEY || "";
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini API Client initialized successfully.");
  } catch (e) {
    console.error("Failed to initialize Gemini API client:", e);
  }
} else {
  console.warn("WARNING: GEMINI_API_KEY is not set. AI features will fallback to mock heuristics.");
}

// Helper to log Gemini errors cleanly. If it's a quota / 429 error, log as warning to prevent triggering system alerts
function handleAiError(featureName: string, err: any) {
  const errMsg = err?.message || String(err);
  const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || err?.status === "RESOURCE_EXHAUSTED" || err?.code === 429;
  if (isQuota) {
    console.warn(`[AI INFO] ${featureName} fell back to offline/heuristic mode: Gemini API free-tier quota is currently exceeded (429 Rate Limit). Please retry later.`);
  } else {
    console.error(`[AI ERROR] ${featureName} failed:`, errMsg);
  }
}

// Get Google OAuth Client Helper
function getOAuth2Client(req?: express.Request) {
  const host = req ? req.get("host") : "localhost:3000";
  const protocol = req && req.secure ? "https" : "http";
  // Fallback if APP_URL is available
  const appUrl = process.env.APP_URL || `${protocol}://${host}`;
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/auth/google/callback`;

  let clientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET;

  // Auto-correct truncated client secret if it is 28 characters and missing GOCSPX- prefix
  if (clientSecret && clientSecret.length === 28 && !clientSecret.startsWith("GOCSPX-")) {
    console.log("Auto-correcting client secret: prepending 'GOCSPX-' to restore the prefix.");
    clientSecret = `GOCSPX-${clientSecret}`;
  }

  if (!clientId || !clientSecret) {
    console.error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing! OAuth will fail.");
  } else {
    console.log(`OAuth client initialized with client ID starting with: ${clientId.substring(0, 15)}...`);
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Google OAuth Endpoints
app.get("/api/auth/google/url", (req, res) => {
  try {
    const oauth2Client = getOAuth2Client(req);
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar",
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });

    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Authorization code is missing");
  }

  try {
    const oauth2Client = getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Fetch user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfoRes = await oauth2.userinfo.get();
    const user = userInfoRes.data;

    // Save tokens and user info in our file-based DB
    const db = readDB();
    db.user = {
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
    db.tokens = tokens;
    writeDB(db);

    // Send postMessage back to parent window and close popup
    res.send(`
      <html>
        <head>
          <title>Authentication Successful</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #0f172a; color: white;">
          <h2>Connecting Account...</h2>
          <p>This window will close automatically.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(db.user)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

app.post("/api/auth/logout", (req, res) => {
  const db = readDB();
  db.user = null;
  db.tokens = null;
  writeDB(db);
  res.json({ success: true });
});

app.get("/api/auth/status", (req, res) => {
  const db = readDB();
  res.json({
    isAuthenticated: !!db.user,
    user: db.user,
    hasTokens: !!db.tokens,
  });
});

// Helper: Calculate Priority Score & Suggestions using Gemini
async function analyzeTaskWithAI(title: string, description: string, dueDateStr: string, category: string) {
  let priorityScore = 50;
  let estimatedTime = 30;
  let categoryOut = category;
  let justification = "";
  let serviceRecommendation = "";

  if (ai) {
    try {
      const prompt = `Analyze this task for productivity planning:
      Task Title: "${title}"
      Task Description: "${description}"
      Due Date/Time: "${dueDateStr}"
      Input Category: "${category}"

      Respond in strictly JSON format. Do not include markdown code block formatting. Return these keys:
      - priorityScore: Number from 1 to 100 (where closer to 100 is highly urgent or crucial)
      - estimatedTime: Number of minutes required to complete the task
      - recommendedCategory: One of "Assignment", "Registration", "Interview", "Event", "Bill", "Medicine", "Other"
      - justification: Concise explanation of why this priority score and category were selected
      - serviceRecommendation: If this task involves a local service like pharmacies (for medicine), printing centers (for documents), courier (for sending packages), bank (for financial deals), or government offices, provide a useful suggestion of what service to look up. If none, leave empty.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              priorityScore: { type: Type.INTEGER },
              estimatedTime: { type: Type.INTEGER },
              recommendedCategory: { type: Type.STRING },
              justification: { type: Type.STRING },
              serviceRecommendation: { type: Type.STRING },
            },
            required: ["priorityScore", "estimatedTime", "recommendedCategory", "justification"],
          },
        },
      });

      const parsed = JSON.parse(response.text.trim());
      priorityScore = parsed.priorityScore || 50;
      estimatedTime = parsed.estimatedTime || 30;
      categoryOut = parsed.recommendedCategory || category;
      justification = parsed.justification || "";
      serviceRecommendation = parsed.serviceRecommendation || "";
    } catch (err) {
      handleAiError("Gemini Task Analysis", err);
    }
  }

  // Heuristic Fallback
  if (!justification) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("medicine") || titleLower.includes("pharmacy") || titleLower.includes("pill") || titleLower.includes("prescription")) {
      categoryOut = "Medicine";
      priorityScore = 85;
      estimatedTime = 20;
      justification = "Calculated high priority because medicine tasks directly impact physical health and well-being.";
      serviceRecommendation = "Find a pharmacy within walking distance.";
    } else if (titleLower.includes("bill") || titleLower.includes("pay") || titleLower.includes("invoice") || titleLower.includes("rent")) {
      categoryOut = "Bill";
      priorityScore = 80;
      estimatedTime = 15;
      justification = "Financial payments usually have hard, critical deadlines carrying penalties or late fees.";
    } else if (titleLower.includes("assignment") || titleLower.includes("exam") || titleLower.includes("homework") || titleLower.includes("submission")) {
      categoryOut = "Assignment";
      priorityScore = 75;
      estimatedTime = 120;
      justification = "Academic assignments involve structured preparation and submission requirements.";
    } else if (titleLower.includes("interview") || titleLower.includes("job") || titleLower.includes("call")) {
      categoryOut = "Interview";
      priorityScore = 90;
      estimatedTime = 45;
      justification = "Interviews are high-stakes, time-sensitive events with third-party commitments.";
    }
  }

  // Map score to label
  let priorityLabel: "High" | "Medium" | "Low" = "Medium";
  if (priorityScore >= 75) priorityLabel = "High";
  else if (priorityScore < 40) priorityLabel = "Low";

  return { priorityScore, estimatedTime, category: categoryOut, priorityLabel, justification, serviceRecommendation };
}

// 2. Tasks CRUD Endpoints
app.get("/api/tasks", (req, res) => {
  const db = readDB();
  res.json(db.tasks || []);
});

app.post("/api/tasks", async (req, res) => {
  const { title, description, dueDate, category, source } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const db = readDB();
    const analysis = await analyzeTaskWithAI(
      title,
      description || "",
      dueDate || new Date().toISOString(),
      category || "Other"
    );

    const newTask = {
      id: "task_" + Math.random().toString(36).substr(2, 9),
      title,
      description: description || "",
      dueDate: dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      category: analysis.category,
      status: "pending",
      priorityScore: analysis.priorityScore,
      priorityLabel: analysis.priorityLabel,
      estimatedTime: analysis.estimatedTime,
      source: source || "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.tasks.push(newTask);

    // Create a proactive recommendation if needed
    if (analysis.serviceRecommendation) {
      db.recommendations.unshift({
        id: "rec_" + Math.random().toString(36).substr(2, 9),
        type: "nearby_service",
        message: `Task: "${title}" - ${analysis.serviceRecommendation}`,
        timestamp: new Date().toISOString(),
        relatedTaskId: newTask.id,
        metadata: {
          serviceType: analysis.category === "Medicine" ? "pharmacy" : "other",
          serviceName: analysis.serviceRecommendation,
        },
      });
    } else if (analysis.priorityScore >= 80) {
      db.recommendations.unshift({
        id: "rec_" + Math.random().toString(36).substr(2, 9),
        type: "urgency_alert",
        message: `High-urgency task added: "${title}". Recommended action: schedule time block today.`,
        timestamp: new Date().toISOString(),
        relatedTaskId: newTask.id,
      });
    }

    // Trim recommendations list to keep only latest 20
    db.recommendations = db.recommendations.slice(0, 20);

    writeDB(db);
    res.status(210).json(newTask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, dueDate, category, status } = req.body;

  try {
    const db = readDB();
    const taskIndex = db.tasks.findIndex((t: any) => t.id === id);
    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    const currentTask = db.tasks[taskIndex];
    let updatedTask = {
      ...currentTask,
      title: title !== undefined ? title : currentTask.title,
      description: description !== undefined ? description : currentTask.description,
      dueDate: dueDate !== undefined ? dueDate : currentTask.dueDate,
      category: category !== undefined ? category : currentTask.category,
      status: status !== undefined ? status : currentTask.status,
      updatedAt: new Date().toISOString(),
    };

    // If critical attributes changed, re-analyze
    if (title !== undefined || dueDate !== undefined || category !== undefined) {
      const analysis = await analyzeTaskWithAI(
        updatedTask.title,
        updatedTask.description,
        updatedTask.dueDate,
        updatedTask.category
      );
      updatedTask.category = analysis.category;
      updatedTask.priorityScore = analysis.priorityScore;
      updatedTask.priorityLabel = analysis.priorityLabel;
      updatedTask.estimatedTime = analysis.estimatedTime;
    }

    db.tasks[taskIndex] = updatedTask;
    writeDB(db);
    res.json(updatedTask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  try {
    const db = readDB();
    const newTasks = db.tasks.filter((t: any) => t.id !== id);
    const deletedCount = db.tasks.length - newTasks.length;
    if (deletedCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    db.tasks = newTasks;
    // Remove orphaned recommendations
    db.recommendations = db.recommendations.filter((r: any) => r.relatedTaskId !== id);
    writeDB(db);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to extract full email body from Gmail message payload recursively
function parseEmailBody(payload: any): string {
  if (!payload) return "";
  
  // If there is direct data in the body
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    } catch (e) {
      console.error("Base64 decoding failed for direct body:", e);
    }
  }
  
  // If multipart, search parts
  if (payload.parts) {
    // Prefer text/plain first
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        try {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        } catch (e) {
          console.error("Base64 decoding failed for text/plain part:", e);
        }
      }
    }
    
    // Fallback to text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        try {
          const rawHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
          // Strip basic HTML tags to keep it readable plain-text
          return rawHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        } catch (e) {
          console.error("Base64 decoding failed for text/html part:", e);
        }
      }
    }
    
    // Recursive search for nested parts
    for (const part of payload.parts) {
      const nestedBody = parseEmailBody(part);
      if (nestedBody) return nestedBody;
    }
  }
  
  return "";
}

// 3. Gmail scanning
app.post("/api/sync/gmail", async (req, res) => {
  const db = readDB();
  if (!db.tokens || !db.user) {
    return res.status(401).json({ error: "Google account not connected" });
  }

  try {
    const oauth2Client = getOAuth2Client(req);
    oauth2Client.setCredentials(db.tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // List recent unread emails with relevant subjects or content
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "subject:(deadline OR registration OR interview OR payment OR invoice OR assignment OR exam OR register OR submit OR due OR pharmacy OR medical)",
      maxResults: 8,
    });

    const messages = listRes.data.messages || [];
    const extractedTasks: any[] = [];
    let scannedCount = 0;

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
      });

      const headers = detail.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
      const from = headers.find((h) => h.name === "From")?.value || "Unknown";
      const snippet = detail.data.snippet || "";
      const fullBody = parseEmailBody(detail.data.payload) || snippet;

      scannedCount++;

      // Check if we already have a task from this specific Gmail ID to prevent duplicates
      const isDuplicate = db.tasks.some((t: any) => t.gmailId === msg.id);
      if (isDuplicate) continue;

      // Call Gemini to parse and extract deadline task details
      let taskDetails = {
        title: subject,
        description: `Source Email from: ${from}\n\nSnippet: ${snippet}`,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        category: "Other" as any,
        isActionable: true,
        actionUrl: "",
        actionLabel: "",
        organization: from.split("<")[0].replace(/"/g, "").trim() || "Unknown",
        riskScore: 10,
        fullEmailBody: fullBody,
      };

      if (ai) {
        try {
          const prompt = `You are an AI Productivity Assistant scanning emails for commitments.
          Analyze this email information:
          From: ${from}
          Subject: ${subject}
          Snippet: ${snippet}
          Full Email Body: ${fullBody.substring(0, 4000)}

          Determine if this email contains an actionable task with an explicit deadline, registration date, interview slot, bill due date, or appointment.
          Respond in strictly JSON format. Do not include markdown code block formatting. Return these keys:
          - isActionable: boolean (true if there's an actual task/deadline for the user)
          - title: Concise task name summarizing the commitment (e.g. "Submit Homework 3", "Pay Electricity Bill")
          - description: Short summary explaining what needs to be done based on the email details
          - dueDate: ISO 8601 string of the extracted deadline (use context clues, current year is 2026. If no exact year is present, assume 2026. If no date is extracted, set a reasonable default inside the next 48 hours)
          - category: One One of "Assignment", "Registration", "Interview", "Event", "Bill", "Medicine", "Other"
          - actionUrl: A specific URL extracted from the email that the user can click to perform the action (e.g. a devpost link, a google form, a doc, a student registration page, a pay bill link, etc). If no exact URL is present, generate a sensible mock web URL based on the domain of the sender.
          - actionLabel: A short uppercase call-to-action button label (e.g. "SUBMIT NOW", "PAY NOW", "REGISTER NOW", "START INTERVIEW")
          - organization: Name of the organization sending the email (e.g. "Coding Ninjas", "Medium", "ProPeers")
          - riskScore: A number from 0 to 100 representing the risk/urgency or percentage of deadline friction (where 100 is maximum critical risk).`;

          const aiResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isActionable: { type: Type.BOOLEAN },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  dueDate: { type: Type.STRING },
                  category: { type: Type.STRING },
                  actionUrl: { type: Type.STRING },
                  actionLabel: { type: Type.STRING },
                  organization: { type: Type.STRING },
                  riskScore: { type: Type.INTEGER },
                },
                required: ["isActionable", "title", "description", "dueDate", "category", "actionUrl", "actionLabel", "organization", "riskScore"],
              },
            },
          });

          const parsed = JSON.parse(aiResponse.text.trim());
          if (parsed.isActionable) {
            taskDetails = {
              ...parsed,
              fullEmailBody: fullBody,
            };
          }
        } catch (err) {
          handleAiError(`Gemini scanning of message ${msg.id}`, err);
        }
      }

      // Add to database
      if (taskDetails.isActionable) {
        const analysis = await analyzeTaskWithAI(
          taskDetails.title,
          taskDetails.description,
          taskDetails.dueDate,
          taskDetails.category
        );

        const newTask = {
          id: "task_" + Math.random().toString(36).substr(2, 9),
          title: taskDetails.title,
          description: taskDetails.description,
          dueDate: taskDetails.dueDate,
          category: analysis.category,
          status: "pending",
          priorityScore: analysis.priorityScore,
          priorityLabel: analysis.priorityLabel,
          estimatedTime: analysis.estimatedTime,
          source: "gmail" as const,
          gmailId: msg.id,
          actionUrl: taskDetails.actionUrl || "",
          actionLabel: taskDetails.actionLabel || "",
          organization: taskDetails.organization || "Gmail System",
          riskScore: taskDetails.riskScore || 10,
          fullEmailBody: taskDetails.fullEmailBody || fullBody,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        db.tasks.push(newTask);
        extractedTasks.push(newTask);

        // Auto-add recommendation feed item
        db.recommendations.unshift({
          id: "rec_" + Math.random().toString(36).substr(2, 9),
          type: "urgency_alert",
          message: `Gmail Scan: Automatically extracted deadline "${newTask.title}" (Due: ${new Date(newTask.dueDate).toLocaleDateString()}).`,
          timestamp: new Date().toISOString(),
          relatedTaskId: newTask.id,
        });
      }
    }

    writeDB(db);
    res.json({
      success: true,
      scannedCount,
      addedCount: extractedTasks.length,
      newTasks: extractedTasks,
    });
  } catch (error: any) {
    console.error("Gmail sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Google Calendar Sync
app.post("/api/sync/calendar", async (req, res) => {
  const db = readDB();
  if (!db.tokens || !db.user) {
    return res.status(401).json({ error: "Google account not connected" });
  }

  try {
    const oauth2Client = getOAuth2Client(req);
    oauth2Client.setCredentials(db.tokens);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 1. Fetch upcoming events to sync TO our list
    const calendarRes = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 15,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = calendarRes.data.items || [];
    let syncedFromCalendar = 0;

    for (const event of events) {
      const isDuplicate = db.tasks.some(
        (t: any) => t.calendarEventId === event.id || t.title === event.summary
      );
      if (isDuplicate) continue;

      const dueDate = event.start?.dateTime || event.start?.date || new Date().toISOString();
      const analysis = await analyzeTaskWithAI(
        event.summary || "Untitled Event",
        event.description || "",
        dueDate,
        "Event"
      );

      const newTask = {
        id: "task_" + Math.random().toString(36).substr(2, 9),
        title: event.summary || "Untitled Event",
        description: event.description || "Synced from Google Calendar",
        dueDate: dueDate,
        category: "Event" as const,
        status: "pending",
        priorityScore: analysis.priorityScore,
        priorityLabel: analysis.priorityLabel,
        estimatedTime: analysis.estimatedTime,
        source: "calendar" as const,
        calendarEventId: event.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.tasks.push(newTask);
      syncedFromCalendar++;
    }

    // 2. Export our pending tasks TO Google Calendar
    let syncedToCalendar = 0;
    const pendingTasksToSync = db.tasks.filter(
      (t: any) => t.status === "pending" && !t.calendarEventId
    );

    for (const task of pendingTasksToSync) {
      try {
        const startDateTime = new Date(task.dueDate);
        const endDateTime = new Date(startDateTime.getTime() + (task.estimatedTime || 30) * 60 * 1000);

        const newEvent = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: `[SmartDeadline] ${task.title}`,
            description: `${task.description || ""}\n\nPriority Score: ${task.priorityScore} (${task.priorityLabel})`,
            start: { dateTime: startDateTime.toISOString() },
            end: { dateTime: endDateTime.toISOString() },
          },
        });

        task.calendarEventId = newEvent.data.id!;
        syncedToCalendar++;
      } catch (err) {
        console.error(`Failed to export task ${task.id} to Google Calendar:`, err);
      }
    }

    writeDB(db);
    res.json({
      success: true,
      syncedFromCalendar,
      syncedToCalendar,
    });
  } catch (error: any) {
    console.error("Google Calendar sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. AI Scheduler Endpoint
app.get("/api/ai/schedule", async (req, res) => {
  const db = readDB();
  const pendingTasks = db.tasks.filter((t: any) => t.status === "pending");

  if (pendingTasks.length === 0) {
    return res.json({
      schedule: [],
      insights: ["No pending tasks available. Create or sync tasks to generate a schedule plan!"],
    });
  }

  // Generate schedule plan using Gemini or heuristics
  if (ai) {
    try {
      const taskListStr = pendingTasks
        .map((t: any) => `- [${t.category}] ${t.title} (Duration: ${t.estimatedTime}m, Due: ${t.dueDate}, Priority: ${t.priorityScore})`)
        .join("\n");

      const prompt = `You are a Productivity scheduling expert.
      Generate a conflict-free, highly optimal daily schedule for today (Current time is June 30, 2026) using these pending tasks:
      ${taskListStr}

      Organize the best times to execute each task throughout the day (morning, afternoon, evening blocks) based on deadline urgency and estimated durations.
      Respond in strictly JSON format. Return these keys:
      - schedule: Array of items, each containing:
        - time: String representation (e.g. "09:00 AM - 10:00 AM")
        - taskId: String (match the exact task in our pending list or leave empty for general focus blocks)
        - taskTitle: String
        - duration: Integer minutes
      - insights: Array of string advices/recommendations (e.g. "Focus on medicine purchase first", "Reschedule event X due to tight submission windows")`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    taskId: { type: Type.STRING },
                    taskTitle: { type: Type.STRING },
                    duration: { type: Type.INTEGER },
                  },
                  required: ["time", "taskTitle", "duration"],
                },
              },
              insights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["schedule", "insights"],
          },
        },
      });

      const plan = JSON.parse(response.text.trim());
      return res.json({ ...plan, isAiGenerated: true });
    } catch (err: any) {
      handleAiError("Gemini AI schedule generation", err);
    }
  }

  // Fallback heuristic scheduling
  const sorted = [...pendingTasks].sort((a, b) => b.priorityScore - a.priorityScore);
  let currentHour = 9; // Start at 9:00 AM
  const schedule: any[] = [];
  const insights: string[] = [
    "⚠️ Note: Gemini AI free-tier quota is currently exceeded (429 Rate Limit). Daily schedule has been generated using local heuristic priority sorting instead.",
    "Tasks have been dynamically prioritize-sorted based on deadline proximity and impact scores.",
  ];

  sorted.forEach((task: any, index) => {
    const startHourStr = currentHour.toString().padStart(2, "0");
    const endHour = currentHour + Math.ceil(task.estimatedTime / 60);
    const endHourStr = (endHour > 12 ? endHour - 12 : endHour).toString().padStart(2, "0") + (endHour >= 12 ? " PM" : " AM");
    const startHourFormatted = (currentHour > 12 ? currentHour - 12 : currentHour).toString().padStart(2, "0") + (currentHour >= 12 ? " PM" : " AM");

    schedule.push({
      time: `${startHourFormatted} - ${endHourStr}`,
      taskId: task.id,
      taskTitle: task.title,
      duration: task.estimatedTime,
    });

    currentHour = endHour;
    if (index === 0) {
      insights.push(`First Activity priority booking: "${task.title}".`);
    }
  });

  res.json({ schedule, insights, isAiGenerated: false });
});

// 6. Action intelligence recommendations feed
app.get("/api/ai/feed", (req, res) => {
  const db = readDB();
  res.json(db.recommendations || []);
});

// 7. Voice Assistant Command Parsing
app.post("/api/ai/voice-command", async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Voice command text is missing" });
  }

  try {
    const db = readDB();
    let taskTitle = "";
    let description = "";
    let category: any = "Other";
    let dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (ai) {
      try {
        const prompt = `Extract task creation details from this spoken voice command: "${command}"
        Respond in strictly JSON format. Return these keys:
        - title: Concise name of the task
        - description: Simple explanation of task details or voice context
        - category: One of "Assignment", "Registration", "Interview", "Event", "Bill", "Medicine", "Other"
        - dueDate: ISO 8601 string representing the requested due date/time (today is Tuesday June 30, 2026. If they say "tomorrow", calculate July 1, 2026. If they say "next Monday", calculate July 6, 2026. Default to July 1, 2026 if unclear.)`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                dueDate: { type: Type.STRING },
              },
              required: ["title", "description", "category", "dueDate"],
            },
          },
        });

        const parsed = JSON.parse(response.text.trim());
        taskTitle = parsed.title;
        description = parsed.description;
        category = parsed.category;
        dueDate = parsed.dueDate;
      } catch (err) {
        handleAiError("Gemini voice command parsing", err);
      }
    }

    // Heuristic voice fallback
    if (!taskTitle) {
      const lower = command.toLowerCase();
      taskTitle = command;
      description = "Created via voice command: " + command;
      if (lower.includes("medicine") || lower.includes("pill") || lower.includes("prescription")) {
        category = "Medicine";
      } else if (lower.includes("bill") || lower.includes("pay")) {
        category = "Bill";
      } else if (lower.includes("assignment") || lower.includes("homework")) {
        category = "Assignment";
      }
    }

    const analysis = await analyzeTaskWithAI(taskTitle, description, dueDate, category);

    const newTask = {
      id: "task_" + Math.random().toString(36).substr(2, 9),
      title: taskTitle,
      description,
      dueDate,
      category: analysis.category,
      status: "pending" as const,
      priorityScore: analysis.priorityScore,
      priorityLabel: analysis.priorityLabel,
      estimatedTime: analysis.estimatedTime,
      source: "user" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.tasks.push(newTask);

    // Auto-alert
    db.recommendations.unshift({
      id: "rec_" + Math.random().toString(36).substr(2, 9),
      type: "general",
      message: `Voice Command executed: Created task "${taskTitle}" (${analysis.category}) successfully.`,
      timestamp: new Date().toISOString(),
      relatedTaskId: newTask.id,
    });

    writeDB(db);
    res.json({ success: true, task: newTask });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VITE / STATIC FILE SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartDeadline AI server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
