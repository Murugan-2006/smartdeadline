import React, { useState, useEffect } from "react";
import {
  MapPin,
  Navigation,
  Compass,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  GraduationCap,
  Building,
  Store,
  Locate,
  Check,
  Map,
  ChevronDown,
  ChevronUp,
  Sliders,
  Sparkles,
} from "lucide-react";
import { Task } from "../types";

// 1. Haversine distance formula to compute high-precision physical distances
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// 2. Automated Task-to-Service Category Mapping Rule
export function getServiceTypeForTask(title: string, category: string): "pharmacy" | "bank" | "printer" | "courier" | "government" | null {
  const t = title.toLowerCase();
  const c = category.toLowerCase();

  if (
    t.includes("medicine") ||
    t.includes("pharmacy") ||
    t.includes("pill") ||
    t.includes("tablet") ||
    t.includes("drug") ||
    t.includes("prescription") ||
    t.includes("syrup") ||
    t.includes("cough") ||
    c === "medicine"
  ) {
    return "pharmacy";
  }
  if (
    t.includes("atm") ||
    t.includes("bank") ||
    t.includes("cash") ||
    t.includes("withdraw") ||
    t.includes("deposit") ||
    t.includes("money") ||
    t.includes("chase") ||
    t.includes("finance") ||
    c === "bill"
  ) {
    return "bank";
  }
  if (
    t.includes("print") ||
    t.includes("xerox") ||
    t.includes("copy") ||
    t.includes("bind") ||
    t.includes("document") ||
    t.includes("paper") ||
    t.includes("printer") ||
    c === "assignment"
  ) {
    return "printer";
  }
  if (
    t.includes("courier") ||
    t.includes("post") ||
    t.includes("ship") ||
    t.includes("dhl") ||
    t.includes("ups") ||
    t.includes("fedex") ||
    t.includes("mail") ||
    t.includes("delivery") ||
    t.includes("package") ||
    t.includes("parcel")
  ) {
    return "courier";
  }
  if (
    t.includes("civic") ||
    t.includes("municipal") ||
    t.includes("government") ||
    t.includes("registry") ||
    t.includes("permit") ||
    t.includes("license") ||
    t.includes("office") ||
    c === "registration"
  ) {
    return "government";
  }

  return null;
}

export interface MockPlace {
  name: string;
  address: string;
  rating: number;
  type: "pharmacy" | "bank" | "printer" | "courier" | "government";
  latOffset: number;
  lngOffset: number;
}

// 3. High-fidelity reference places defined relative to Chennai CIT center
export const MOCK_PLACES: MockPlace[] = [
  {
    name: "Walgreens 24-Hour Pharmacy",
    address: "102 Tech Plaza Lane",
    rating: 4.5,
    type: "pharmacy",
    latOffset: 0.002, // ~220m North
    lngOffset: -0.001, // ~110m West
  },
  {
    name: "CVS Care Pharmacy",
    address: "44 College Way, West Wing",
    rating: 4.2,
    type: "pharmacy",
    latOffset: -0.003, // ~330m South
    lngOffset: 0.002, // ~220m East
  },
  {
    name: "Chase Financial Center ATM",
    address: "201 Financial Boulevard",
    rating: 4.4,
    type: "bank",
    latOffset: -0.001, // ~110m South
    lngOffset: 0.001, // ~110m East
  },
  {
    name: "Bank of America ATM & Branch",
    address: "710 Plaza Commercial",
    rating: 4.0,
    type: "bank",
    latOffset: 0.002,
    lngOffset: 0.004,
  },
  {
    name: "FedEx Print & Ship Center",
    address: "88 Logistics Row",
    rating: 4.3,
    type: "printer",
    latOffset: 0.001,
    lngOffset: 0.003,
  },
  {
    name: "Instant Print & Bind Services",
    address: "505 Commerce Expressway",
    rating: 4.6,
    type: "printer",
    latOffset: -0.002,
    lngOffset: -0.002,
  },
  {
    name: "DHL Express Delivery Station",
    address: "1 Civic Center Dr",
    rating: 4.4,
    type: "courier",
    latOffset: 0.003,
    lngOffset: -0.003,
  },
  {
    name: "UPS Center & Courier Drop",
    address: "22 Government Square",
    rating: 4.1,
    type: "courier",
    latOffset: -0.0015,
    lngOffset: -0.001,
  },
];

// Presets representing different coordinate hotspots
export const PRESETS = [
  {
    id: "cit",
    name: "Chennai Institute of Tech (CIT Center)",
    lat: 12.8906,
    lng: 80.0412,
    desc: "Default college center. Walgreens is 240m away, Chase ATM is 150m away.",
  },
  {
    id: "walgreens_close",
    name: "Near Walgreens Pharmacy (North Hotspot)",
    lat: 12.8924,
    lng: 80.0400,
    desc: "Walgreens is 30m away! Ideal for completing 'buy medicine' tasks.",
  },
  {
    id: "chase_close",
    name: "Near Chase Financial ATM (East Hotspot)",
    lat: 12.8895,
    lng: 80.0423,
    desc: "Chase Bank ATM is 15m away! Perfect for completing 'go to ATM' tasks.",
  },
  {
    id: "home_far",
    name: "At Home / Far Away (Out of Sector)",
    lat: 12.9100,
    lng: 80.0600,
    desc: "2.1km away from sectors. Exceeds 500m scan limit; matches won't show.",
  },
];

interface NearbyServicesProps {
  userLocation: { lat: number; lng: number };
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  locationPreset: string;
  setLocationPreset: (preset: string) => void;
  tasks: Task[];
  onToggleStatus: (id: string, currentStatus: "pending" | "completed") => void;
  initialServiceType?: string; // Kept for interface compatibility
  onArriveNearService?: (serviceName: string) => void; // Kept for interface compatibility
}

export default function NearbyServices({
  userLocation,
  setUserLocation,
  locationPreset,
  setLocationPreset,
  tasks,
  onToggleStatus,
}: NearbyServicesProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locatingError, setLocatingError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState<boolean>(false); // Collapsed by default!
  const [zoom, setZoom] = useState<number>(1.2);
  const [scanAnimationPulse, setScanAnimationPulse] = useState(true);

  // Simple feedback banner
  const [feedback, setFeedback] = useState<string | null>(null);

  // Trigger geolocation lookups
  const requestLiveGPS = () => {
    if (!navigator.geolocation) {
      setLocatingError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocatingError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationPreset("live");
        setIsLocating(false);
        triggerFeedback("Live GPS location locked! Sector scan updating.");
      },
      (err) => {
        console.error("Geolocation failed, sticking to simulated hotspots:", err);
        setLocatingError("GPS permission denied or timed out. Switched to simulated high-fidelity sector.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Toggle scan pulses for a beautiful live radar effect
  useEffect(() => {
    const interval = setInterval(() => {
      setScanAnimationPulse((p) => !p);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const activePresetInfo = PRESETS.find((p) => p.id === locationPreset);

  // Filter tasks to see which ones are pending and match the location-based criteria
  const activePendingTasks = tasks.filter((t) => t.status === "pending");

  // Compute matches specifically within 500 meters
  const taskLocationMatches = activePendingTasks
    .map((task) => {
      const matchedType = getServiceTypeForTask(task.title, task.category);
      if (!matchedType) return null;

      // Find Mock Places of this type, calculate their physical distance
      const matchingPlaces = MOCK_PLACES.filter((p) => p.type === matchedType).map((place) => {
        // Project mock location from base coordinates
        const placeLat = 12.8906 + place.latOffset;
        const placeLng = 80.0412 + place.lngOffset;
        const dist = getDistanceInMeters(userLocation.lat, userLocation.lng, placeLat, placeLng);
        return { ...place, dist, placeLat, placeLng };
      });

      // Find closest place
      if (matchingPlaces.length === 0) return null;
      const closest = matchingPlaces.sort((a, b) => a.dist - b.dist)[0];

      return {
        task,
        place: closest,
        inRange: closest.dist <= 500, // Strict 500-meter constraint
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const matchedCount = taskLocationMatches.filter((m) => m.inRange).length;

  // Handle auto check-off
  const handleCheckOff = (taskId: string, taskTitle: string, placeName: string) => {
    onToggleStatus(taskId, "pending");
    triggerFeedback(`Completed: "${taskTitle}" checked-off near ${placeName}!`);
  };

  // Projection coordinate helpers for the vector map SVG overlay
  const getX = (lng: number) => {
    const diff = lng - userLocation.lng;
    return 50 + diff * 15000 * zoom;
  };

  const getY = (lat: number) => {
    const diff = lat - userLocation.lat;
    return 50 - diff * 15000 * zoom; // invert latitude for screen coordinates
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-900 shadow-sm transition-all" id="nearby-services-panel">
      {/* Panel Title & Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className="relative flex h-3 w-3">
            <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${scanAnimationPulse ? "animate-ping" : ""}`}></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-tight uppercase font-mono text-slate-900 flex items-center space-x-1">
              <span>Agent Geolocation Scan Center</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Active tracking: <span className="text-emerald-600 font-semibold">500m Sector Scan Range</span>
            </p>
          </div>
        </div>

        {/* GPS Control */}
        <div className="flex items-center space-x-2">
          <button
            onClick={requestLiveGPS}
            disabled={isLocating}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 hover:text-slate-900 transition cursor-pointer"
          >
            {isLocating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                <span>Fixing GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5" />
                <span>Query Live GPS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {locatingError && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{locatingError}</span>
        </div>
      )}

      {feedback && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[11px] flex items-center space-x-2 animate-fade-in font-mono">
          <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Grid: Simulator Presets & Detections */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Presets Controls */}
        <div className="lg:col-span-5 bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-3.5">
          <div className="flex items-center space-x-1.5">
            <Sliders className="w-4 h-4 text-slate-650" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700">
              Location Simulation
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Toggle simulated locations below to verify how tasks instantly match or drop out of range when crossing the <strong>500-meter threshold</strong>.
          </p>

          <div className="space-y-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setUserLocation({ lat: preset.lat, lng: preset.lng });
                  setLocationPreset(preset.id);
                  triggerFeedback(`Simulated position changed to ${preset.name}`);
                }}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex flex-col space-y-1 ${
                  locationPreset === preset.id
                    ? "bg-white border-slate-900 shadow-sm"
                    : "bg-white/40 border-slate-200 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${locationPreset === preset.id ? "text-slate-900" : "text-slate-700"}`}>
                    {preset.name}
                  </span>
                  {locationPreset === preset.id && <Check className="w-3.5 h-3.5 text-slate-900" />}
                </div>
                <span className="text-[10px] text-slate-400 font-sans leading-normal">
                  {preset.desc}
                </span>
              </button>
            ))}

            {locationPreset === "live" && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800 font-mono">
                📍 Active: Live browser GPS Location
                <div className="mt-0.5 text-emerald-600">
                  Lat: {userLocation.lat.toFixed(5)}°, Lng: {userLocation.lng.toFixed(5)}°
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Automatic Detections */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700">
              Live Automated Scans
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-650">
              {matchedCount} in range (≤ 500m)
            </span>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto">
            {taskLocationMatches.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-white">
                <Compass className="w-7 h-7 mx-auto mb-2 text-slate-300 animate-spin-slow" />
                <p className="text-xs font-semibold text-slate-800">No Location Tasks Found</p>
                <p className="text-[10px] mt-0.5 text-slate-400 max-w-xs mx-auto">
                  Add a task like "to buy medicine" or "withdraw money" to see the background agent scan locations.
                </p>
              </div>
            ) : (
              taskLocationMatches.map(({ task, place, inRange }, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition ${
                    inRange
                      ? "bg-white border-emerald-500 shadow-sm"
                      : "bg-slate-50/50 border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border ${
                          inRange ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-250"
                        }`}>
                          {inRange ? "Within Range" : "Exceeds Range"}
                        </span>
                        <span className="text-[11px] font-bold text-slate-800 truncate max-w-[150px]">
                          {task.title}
                        </span>
                      </div>

                      <div className="mt-2 text-[10px] text-slate-600 font-sans">
                        Nearby: <strong className="text-slate-800">{place.name}</strong>
                        <div className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                          Distance: <span className={inRange ? "text-emerald-600 font-semibold" : "text-slate-500"}>{place.dist}m</span> / {Math.round(place.dist / 80)} mins walk
                        </div>
                      </div>
                    </div>

                    {inRange ? (
                      <button
                        onClick={() => handleCheckOff(task.id, task.title, place.name)}
                        className="px-2.5 py-1.5 bg-black hover:bg-slate-800 text-white rounded text-[10px] font-bold font-mono transition cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Arrive</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 py-1">
                        &gt; 500m scan limit
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Map Toggle Option */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col">
        <button
          onClick={() => setShowMap(!showMap)}
          className="self-center flex items-center space-x-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 transition cursor-pointer"
        >
          <Map className="w-4 h-4" />
          <span>{showMap ? "Hide Visual Map HUD" : "Show Visual Map HUD (Optional)"}</span>
          {showMap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMap && (
          <div className="mt-4 border border-slate-800 bg-[#121214] rounded-xl relative overflow-hidden aspect-[16/9] flex flex-col justify-between p-4 font-mono select-none shadow-inner animate-fade-in">
            {/* Interactive Vector Map Layer */}
            <div className="absolute inset-0 z-0">
              <svg className="w-full h-full opacity-95">
                <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1d1d22" strokeWidth="1" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#mapGrid)" />

                {/* Chennai Roads Network Vector */}
                {[
                  [
                    { lat: userLocation.lat + 0.004, lng: userLocation.lng + 0.005 },
                    { lat: userLocation.lat + 0.0018, lng: userLocation.lng + 0.0025 },
                    { lat: userLocation.lat, lng: userLocation.lng },
                    { lat: userLocation.lat - 0.003, lng: userLocation.lng - 0.002 },
                  ],
                  [
                    { lat: userLocation.lat + 0.001, lng: userLocation.lng - 0.006 },
                    { lat: userLocation.lat + 0.001, lng: userLocation.lng + 0.006 },
                  ],
                ].map((road, idx) => {
                  const d = road
                    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(p.lng)}% ${getY(p.lat)}%`)
                    .join(" ");
                  return (
                    <g key={idx}>
                      <path d={d} fill="none" stroke="#2c2d30" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  );
                })}

                {/* Draw 500m Scan Circle HUD directly on map */}
                <circle
                  cx="50%"
                  cy="50%"
                  r="120"
                  fill="rgba(16, 185, 129, 0.015)"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
              </svg>
            </div>

            {/* Simulated Live User GPS Indicator */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
              <div className="relative flex h-5 w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-35"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
              </div>
              <span className="text-[7.5px] text-emerald-400 font-bold bg-[#0f0f12]/95 border border-emerald-900 px-1 rounded mt-1 whitespace-nowrap">
                YOU (SIMULATED GPS)
              </span>
            </div>

            {/* Map Markers Overlay for Reference Places */}
            <div className="absolute inset-0 z-5 pointer-events-none">
              {MOCK_PLACES.map((place, index) => {
                const placeLat = 12.8906 + place.latOffset;
                const placeLng = 80.0412 + place.lngOffset;
                const x = getX(placeLng);
                const y = getY(placeLat);
                const dist = getDistanceInMeters(userLocation.lat, userLocation.lng, placeLat, placeLng);
                const inRange = dist <= 500;

                // Keep markers bound within visible canvas
                if (x < 5 || x > 95 || y < 5 || y > 95) return null;

                return (
                  <div
                    key={index}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-white ${
                      inRange ? "bg-emerald-950 border-emerald-500" : "bg-slate-900 border-slate-700 opacity-50"
                    }`}>
                      {place.type === "pharmacy" ? (
                        <Store className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <MapPin className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                    <div className="mt-1 bg-[#0c0c0e]/95 border border-[#232328] rounded px-1 shadow-sm max-w-[100px]">
                      <p className="text-[7px] text-slate-200 font-bold truncate">{place.name}</p>
                      <p className={`text-[6.5px] font-bold ${inRange ? "text-emerald-400" : "text-slate-500"}`}>
                        {dist}m
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* HUD Status Text Overlays */}
            <div className="relative z-10 flex items-start justify-between pointer-events-none">
              <span className="text-[8px] text-emerald-500 uppercase tracking-widest bg-[#121214]/90 px-1.5 py-0.5 rounded border border-emerald-900 shadow-sm font-semibold">
                SECTOR SCAN RADAR: ACTIVE
              </span>
              <span className="text-[8px] text-slate-400 bg-[#121214]/90 px-1.5 py-0.5 rounded border border-[#27272a] shadow-sm uppercase">
                500m Scan Range Circle (Green)
              </span>
            </div>

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col bg-white rounded shadow-md overflow-hidden pointer-events-auto">
              <button onClick={() => setZoom((z) => Math.min(z + 0.2, 3))} className="w-7 h-7 flex items-center justify-center border-b border-slate-200 hover:bg-slate-50 text-slate-800">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))} className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 text-slate-800">
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
