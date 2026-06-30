import React, { useState, useEffect } from "react";
import { Mic, MicOff, Plus, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { TaskCategory } from "../types";

interface TaskFormProps {
  onAddTask: (task: {
    title: string;
    description: string;
    dueDate: string;
    category: TaskCategory;
    source: "user";
  }) => Promise<void>;
  onVoiceCommand: (commandText: string) => Promise<any>;
}

export default function TaskForm({ onAddTask, onVoiceCommand }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("Other");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Check for speech recognition in browser
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechRecognitionSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onresult = async (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsListening(false);

        // Process with backend
        setIsSubmitting(true);
        try {
          const result = await onVoiceCommand(text);
          if (result && result.success) {
            // Task added successfully
            setTitle("");
            setDescription("");
            setTranscript("");
          } else {
            setError("Could not parse task from your voice. Try speaking again clearly.");
          }
        } catch (err) {
          setError("Failed to communicate voice command to backend AI.");
        } finally {
          setIsSubmitting(false);
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setIsListening(false);
        if (e.error === "not-allowed") {
          setError("Microphone permission denied. Please allow mic access in your browser.");
        } else {
          setError("Speech recognition failed. Please try again.");
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, [onVoiceCommand]);

  const toggleListening = () => {
    if (!speechRecognitionSupported) {
      setError("Web Speech Recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      setTranscript("");
      setError(null);
      recognition.start();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const defaultDate = dueDate
        ? new Date(dueDate).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default to tomorrow

      await onAddTask({
        title: title.trim(),
        description: description.trim(),
        dueDate: defaultDate,
        category,
        source: "user",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("Other");
      setDueDate("");
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 text-slate-900 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <h2 className="text-xs font-bold tracking-tight uppercase font-mono text-slate-900">
          Create Actionable Task
        </h2>

        {/* Voice Command Button */}
        <div className="flex items-center space-x-1">
          {speechRecognitionSupported ? (
            <button
              type="button"
              onClick={toggleListening}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                isListening
                  ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
              title={isListening ? "Listening... click to stop" : "Use AI voice command"}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3 h-3" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-3 h-3 text-slate-600" />
                  <span>Voice Add</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-[9px] text-slate-400 font-mono">Voice Unsupported</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start space-x-2 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Listening Feedback */}
      {isListening && (
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <div className="flex items-center justify-center space-x-1.5 mb-2">
            <span className="w-2 h-2 bg-slate-900 rounded-full animate-bounce delay-0" />
            <span className="w-2 h-2 bg-slate-900 rounded-full animate-bounce delay-150" />
            <span className="w-2 h-2 bg-slate-900 rounded-full animate-bounce delay-300" />
          </div>
          <p className="text-xs font-semibold text-slate-900 animate-pulse font-mono">
            Listening... Speak clearly e.g.
          </p>
          <p className="text-[10px] text-slate-500 italic mt-1 font-mono">
            &quot;Remind me to buy medicine tomorrow&quot; or &quot;Track my homework deadline&quot;
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1">
            Task Name *
          </label>
          <input
            type="text"
            required
            disabled={isSubmitting || isListening}
            placeholder="e.g. Purchase antibiotics, Submit assignment"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 border border-slate-250 focus:border-black rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 transition outline-none focus:bg-white"
          />
        </div>

        {/* Category & Due Date Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1">
              Category
            </label>
            <select
              value={category}
              disabled={isSubmitting || isListening}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="w-full bg-slate-50 border border-slate-250 focus:border-black rounded-lg px-3 py-2 text-xs text-slate-900 transition outline-none focus:bg-white"
            >
              <option value="Assignment">Assignment</option>
              <option value="Registration">Registration</option>
              <option value="Interview">Interview</option>
              <option value="Event">Event</option>
              <option value="Bill">Bill</option>
              <option value="Medicine">Medicine</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1">
              Deadline
            </label>
            <input
              type="datetime-local"
              disabled={isSubmitting || isListening}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250 focus:border-black rounded-lg px-3 py-2 text-xs text-slate-900 transition outline-none focus:bg-white"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1">
            Additional Details (Optional)
          </label>
          <textarea
            disabled={isSubmitting || isListening}
            placeholder="Provide context, links, or instructions..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-slate-50 border border-slate-250 focus:border-black rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 transition outline-none resize-none focus:bg-white"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || isListening}
          className="w-full bg-black hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg text-xs transition duration-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Task...</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Analyze & Add Task</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
