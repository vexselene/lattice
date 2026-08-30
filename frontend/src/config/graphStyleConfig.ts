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
      dimmedFill: "#334155" 
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
