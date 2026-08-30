export const GRAPH_STYLE = {
  colors: {
    edge: { 
      baseDark: "#64748b", 
      baseLight: "#475569", 
      hover: "#818cf8", 
      highlighted: "#4338ca", 
      dimmed: "#47556998" 
    },
    node: { 
      dimmedFill: "#334155",
      email: {
        dark: {
          bg: "#1e1b4b", // bg-indigo-950
          text: "#c7d2fe", // text-indigo-200
          iconBg: "rgba(49, 46, 129, 0.5)", // bg-indigo-900/50
          iconText: "#a5b4fc", // text-indigo-300
          border: "#3730a3",
          ring: "#6366f1",
        },
        light: {
          bg: "#eef2ff", // bg-indigo-50
          text: "#1e1b4b", // text-indigo-950
          iconBg: "#e0e7ff", // bg-indigo-100
          iconText: "#4f46e5", // text-indigo-600
          border: "#c7d2fe",
          ring: "#6366f1",
        }
      },
      account: {
        dark: {
          bg: "#3b0764", // bg-purple-950
          text: "#e9d5ff", // text-purple-200
          iconBg: "rgba(88, 28, 135, 0.5)", // bg-purple-900/50
          iconText: "#d8b4fe", // text-purple-300
          border: "#6b21a8",
          ring: "#a855f7",
        },
        light: {
          bg: "#faf5ff", // bg-purple-50
          text: "#3b0764", // text-purple-950
          iconBg: "#f3e8ff", // bg-purple-100
          iconText: "#9333ea", // text-purple-600
          border: "#e9d5ff",
          ring: "#a855f7",
        }
      },
      phone: {
        dark: {
          bg: "#451a03", // bg-amber-950
          text: "#fde68a", // text-amber-200
          iconBg: "rgba(120, 53, 15, 0.5)", // bg-amber-900/50
          iconText: "#fcd34d", // text-amber-300
          border: "#92400e",
          ring: "#f59e0b",
        },
        light: {
          bg: "#fffbeb", // bg-amber-50
          text: "#451a03", // text-amber-950
          iconBg: "#fef3c7", // bg-amber-100
          iconText: "#d97706", // text-amber-600
          border: "#fde68a",
          ring: "#f59e0b",
        }
      },
      service: {
        dark: {
          bg: "#022c22", // bg-emerald-950
          text: "#a7f3d0", // text-emerald-200
          iconBg: "rgba(6, 78, 59, 0.5)", // bg-emerald-900/50
          iconText: "#6ee7b7", // text-emerald-300
          border: "#065f46",
          ring: "#10b981",
        },
        light: {
          bg: "#ecfdf5", // bg-emerald-50
          text: "#022c22", // text-emerald-950
          iconBg: "#d1fae5", // bg-emerald-100
          iconText: "#059669", // text-emerald-600
          border: "#a7f3d0",
          ring: "#10b981",
        }
      },
    },
  },
  edgeLabel: {
    fontSizePx: 10,
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heightPx: 18,
    paddingX: 7,
    borderRadius: 4,
    colors: {
      dark: {
        bg: "#111625",
        text: "#cbd5e1",
        border: "#1e293b",
      },
      light: {
        bg: "#ffffff",
        text: "#1e293b",
        border: "#e2e8f0",
      },
    },
  },
  opacity: { 
    dimmed: 0.3, 
    isolatedHidden: 0,
    normal: 1 
  },
  blur: { 
    dimmed: "0.5px",
    none: "0px" 
  },
  grayscale: { 
    dimmed: "30%",
    none: "0%" 
  },
  strokeWidth: { 
    base: 1.25, 
    hover: 2.0,
    highlighted: 2.5 
  },
  hitbox: { 
    width: 24 
  },
  glow: { 
    highlighted: "drop-shadow(0 0 5px rgba(129, 140, 248, 0.8))" 
  },
  timing: { 
    clickDelayMs: 250, 
    doubleTapThresholdMs: 450, 
    suppressWindowMs: 500 
  },
  layout: { 
    nodeWidth: 320, 
    nodeHeightBase: 80, 
    proximityThresholdPx: 120 
  },
  export: { 
    paddingPx: 60 
  },
} as const;
