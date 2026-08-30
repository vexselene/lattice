import { describe, it, expect } from 'vitest';
import { computeNodeVisualState, computeEdgeVisualState, RING_CLASSES } from './useVisualState';
import { GRAPH_STYLE } from '../config/graphStyleConfig';

describe('computeNodeVisualState (pure function)', () => {
  it('returns normal default styling when no flags or sets are provided', () => {
    const state = computeNodeVisualState('node-1');
    expect(state.opacity).toBe(GRAPH_STYLE.opacity.normal);
    expect(state.filter).toBe(`blur(${GRAPH_STYLE.blur.none}) grayscale(${GRAPH_STYLE.grayscale.none})`);
    expect(state.ringClass).toBe('');
    expect(state.isVisible).toBe(true);
    expect(state.isDimmed).toBe(false);
    expect(state.isSelected).toBe(false);
  });

  it('computes selected state with appropriate ring class', () => {
    const state = computeNodeVisualState(
      { id: 'node-1', type: 'email' },
      { selectedIds: new Set(['node-1']) }
    );
    expect(state.isSelected).toBe(true);
    expect(state.ringClass).toBe(RING_CLASSES.email);
    expect(state.opacity).toBe(GRAPH_STYLE.opacity.normal);
  });

  it('computes dimmed state with dimmed opacity and filter', () => {
    const state = computeNodeVisualState('node-1', {
      dimmedIds: new Set(['node-1']),
    });
    expect(state.isDimmed).toBe(true);
    expect(state.opacity).toBe(GRAPH_STYLE.opacity.dimmed);
    expect(state.filter).toBe(`blur(${GRAPH_STYLE.blur.dimmed}) grayscale(${GRAPH_STYLE.grayscale.dimmed})`);
  });

  it('computes isolated / hidden state', () => {
    const state = computeNodeVisualState('node-1', {
      isolatedIds: new Set(['node-2']), // node-1 not in isolatedIds
    });
    expect(state.isVisible).toBe(false);
    expect(state.opacity).toBe(GRAPH_STYLE.opacity.isolatedHidden);
  });

  it('strips highlight rings during export when exportKeepHighlightRings is false', () => {
    const state = computeNodeVisualState(
      { id: 'node-1', type: 'account' },
      {
        selectedIds: new Set(['node-1']),
        isExporting: true,
        exportKeepHighlightRings: false,
      }
    );
    expect(state.isSelected).toBe(true);
    expect(state.ringClass).toBe('');
  });
});

describe('computeEdgeVisualState (pure function)', () => {
  it('returns default edge styling in dark mode', () => {
    const state = computeEdgeVisualState('edge-1', { theme: 'dark' });
    expect(state.stroke).toBe(GRAPH_STYLE.colors.edge.baseDark);
    expect(state.strokeWidth).toBe(GRAPH_STYLE.strokeWidth.base);
    expect(state.opacity).toBe(GRAPH_STYLE.opacity.normal);
    expect(state.filter).toBe('none');
    expect(state.hitboxWidth).toBe(GRAPH_STYLE.hitbox.width);
    expect(state.isDimmed).toBe(false);
    expect(state.isHighlighted).toBe(false);
  });

  it('computes hovered edge styling', () => {
    const state = computeEdgeVisualState('edge-1', {
      isHovered: true,
      theme: 'dark',
    });
    expect(state.stroke).toBe(GRAPH_STYLE.colors.edge.hover);
    expect(state.strokeWidth).toBe(GRAPH_STYLE.strokeWidth.hover);
    expect(state.filter).toBe('drop-shadow(0 0 3px rgba(129, 140, 248, 0.3))');
  });

  it('computes selected / highlighted edge styling', () => {
    const state = computeEdgeVisualState('edge-1', {
      highlightedIds: new Set(['edge-1']),
    });
    expect(state.isHighlighted).toBe(true);
    expect(state.stroke).toBe(GRAPH_STYLE.colors.edge.hover);
    expect(state.strokeWidth).toBe(GRAPH_STYLE.strokeWidth.highlighted);
    expect(state.filter).toBe(GRAPH_STYLE.glow.highlighted);
    expect(state.strokeDasharray).toBe('5 5');
  });

  it('computes dimmed edge styling', () => {
    const state = computeEdgeVisualState('edge-1', {
      dimmedIds: new Set(['edge-1']),
    });
    expect(state.isDimmed).toBe(true);
    expect(state.stroke).toBe(GRAPH_STYLE.colors.edge.dimmed);
    expect(state.opacity).toBe(GRAPH_STYLE.opacity.dimmed);
    expect(state.filter).toBe(`blur(${GRAPH_STYLE.blur.dimmed})`);
  });
});
