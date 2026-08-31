import { describe, it, expect, beforeEach } from 'vitest';
import { graphToSvgString } from './exportRenderer';
import { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import { useGraphStore } from '../stores/graphStore';
import { GRAPH_STYLE } from '../config/graphStyleConfig';

describe('graphToSvgString', () => {
  const mockFlowNodes: FlowNode[] = [
    {
      id: 'node-1',
      type: 'email',
      position: { x: 0, y: 0 },
      data: {
        id: 'node-1',
        address: 'test1@example.com',
      },
    },
    {
      id: 'node-2',
      type: 'account',
      position: { x: 300, y: 0 },
      data: {
        id: 'node-2',
        username: 'test_user',
        service_id: 'node-3',
      },
    },
    {
      id: 'node-3',
      type: 'service',
      position: { x: 600, y: 0 },
      data: {
        id: 'node-3',
        name: 'GitHub',
      },
    },
  ];

  const mockFlowEdges: FlowEdge[] = [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      data: {
        relation: 'registered_with',
      },
    },
    {
      id: 'edge-2',
      source: 'node-2',
      target: 'node-3',
      data: {
        relation: 'linked_account',
      },
    },
  ];

  beforeEach(() => {
    useGraphStore.setState({
      nodes: [
        { type: 'email', data: { id: 'node-1', address: 'test1@example.com', created_at: '', updated_at: '' } },
        { type: 'account', data: { id: 'node-2', username: 'test_user', service_id: 'node-3', created_at: '', updated_at: '' } },
        { type: 'service', data: { id: 'node-3', name: 'GitHub', created_at: '', updated_at: '' } },
      ],
      edges: [
        { id: 'edge-1', source_type: 'email', source_id: 'node-1', target_type: 'account', target_id: 'node-2', relation: 'registered_with' },
        { id: 'edge-2', source_type: 'account', source_id: 'node-2', target_type: 'service', target_id: 'node-3', relation: 'linked_account' },
      ],
      selectedNodeIds: new Set(['node-1', 'node-3']), // Non-adjacent nodes
      activeChain: {
        nodeIds: new Set(['node-1', 'node-2']),
        edgeIds: new Set(['edge-1']),
      },
    });
  });

  it('renders all nodes and edges in "all" mode with full opacity and inline styles', () => {
    const svg = graphToSvgString(mockFlowNodes, mockFlowEdges, 'all', { theme: 'dark' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');

    const foreignObjectMatches = svg.match(/<foreignObject/g) || [];
    expect(foreignObjectMatches.length).toBe(3);

    // Verify XHTML namespace is declared for standalone SVG rendering
    expect(svg).toContain('xmlns="http://www.w3.org/1999/xhtml"');

    // Verify inline CSS styles are applied on nodes for standalone rendering
    expect(svg).toContain(`background-color:${GRAPH_STYLE.colors.node.email.dark.bg}`);
    expect(svg).toContain(`background-color:${GRAPH_STYLE.colors.node.account.dark.bg}`);
    expect(svg).toContain(`background-color:${GRAPH_STYLE.colors.node.service.dark.bg}`);

    const pathMatches = svg.match(/<path d="M/g) || [];
    expect(pathMatches.length).toBeGreaterThanOrEqual(2);

    // Verify explicit font-size and fill on edge label <text>
    expect(svg).toContain(`font-size="${GRAPH_STYLE.edgeLabel.fontSizePx}px"`);
    expect(svg).toContain(`fill="${GRAPH_STYLE.edgeLabel.colors.dark.text}"`);
    expect(svg).toContain(`fill="${GRAPH_STYLE.edgeLabel.colors.dark.bg}"`);

    // Verify unified marker definitions matching React Flow live canvas
    expect(svg).toContain('viewBox="-10 -10 20 20"');
    expect(svg).toContain('markerUnits="strokeWidth"');
    // Verify edges are solid by default in "all" mode (no stroke-dasharray)
    const edgesGroup = svg.substring(svg.indexOf('<g class="edges">'), svg.indexOf('</g>'));
    expect(edgesGroup).not.toContain('stroke-dasharray');
  });

  it('renders full graph in "dimmed" mode with activeChain highlighted and rest dimmed', () => {
    useGraphStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      activeChain: {
        nodeIds: new Set(['node-1', 'node-2']),
        edgeIds: new Set(['edge-1']),
      },
    });
    const svg = graphToSvgString(mockFlowNodes, mockFlowEdges, 'dimmed', { theme: 'dark' });

    // Should include all 3 nodes
    const foreignObjectMatches = svg.match(/<foreignObject/g) || [];
    expect(foreignObjectMatches.length).toBe(3);

    // Dimmed style token check (opacity: 0.3)
    expect(svg).toContain(`opacity:${GRAPH_STYLE.opacity.dimmed}`);

    // Active chain highlighted edge should have dashed stroke
    expect(svg).toContain('stroke-dasharray="5 5"');
    expect(svg).toContain(`stroke="${GRAPH_STYLE.colors.edge.highlightDark}"`);
  });

  it('renders highlighted edges and matching markers with darkened blue tone in light theme', () => {
    useGraphStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      activeChain: {
        nodeIds: new Set(['node-1', 'node-2']),
        edgeIds: new Set(['edge-1']),
      },
    });
    const svgLight = graphToSvgString(mockFlowNodes, mockFlowEdges, 'dimmed', { theme: 'light' });

    // Active chain highlighted edge in light mode should use darkened high-contrast navy/indigo (#1d1764)
    expect(svgLight).toContain(`stroke="${GRAPH_STYLE.colors.edge.highlightLight}"`);
    expect(svgLight).toContain('stroke="#1d1764"');
    expect(svgLight).toContain('stroke-dasharray="5 5"');
  });

  it('renders ONLY selected nodes and 0 edges in "isolated" mode when selected nodes are not adjacent', () => {
    useGraphStore.setState({
      selectedNodeIds: new Set(['node-1', 'node-3']),
      selectedEdgeIds: new Set(),
      activeChain: null,
    });
    const svg = graphToSvgString(mockFlowNodes, mockFlowEdges, 'isolated', { theme: 'dark' });

    // Should include exactly 2 nodes (node-1 and node-3)
    const foreignObjectMatches = svg.match(/<foreignObject/g) || [];
    expect(foreignObjectMatches.length).toBe(2);

    // Edges group should have 0 edge paths because node-1 and node-3 have no connecting edge
    const edgesGroup = svg.substring(svg.indexOf('<g class="edges">'), svg.indexOf('</g>'));
    expect(edgesGroup.includes('<path d="M')).toBe(false);
  });

  it('renders inline box-shadow highlight rings when keepHighlightRings is true', () => {
    const svg = graphToSvgString(mockFlowNodes, mockFlowEdges, 'all', { theme: 'dark', keepHighlightRings: true });
    // node-1 is selected, so it should render with box-shadow ring
    expect(svg).toContain(`box-shadow:0 0 0 2px ${GRAPH_STYLE.colors.node.email.dark.ring}`);
  });

  it('renders correctly in "dimmed" and "isolated" modes when edge is clicked (selectedEdgeIds)', () => {
    useGraphStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(['edge-1']),
      activeChain: null,
    });

    // Dimmed mode: 3 nodes in total, node-1 and node-2 undimmed, node-3 dimmed
    const svgDimmed = graphToSvgString(mockFlowNodes, mockFlowEdges, 'dimmed', { theme: 'dark' });
    const foreignObjectMatches = svgDimmed.match(/<foreignObject/g) || [];
    expect(foreignObjectMatches.length).toBe(3);
    expect(svgDimmed).toContain('stroke-dasharray="5 5"'); // edge-1 is dashed/highlighted
    expect(svgDimmed).toContain(`opacity:${GRAPH_STYLE.opacity.dimmed}`); // node-3 and edge-2 dimmed

    // Isolated mode: exactly 2 endpoint nodes (node-1, node-2) and 1 edge (edge-1)
    const svgIsolated = graphToSvgString(mockFlowNodes, mockFlowEdges, 'isolated', { theme: 'dark' });
    const isolatedNodes = svgIsolated.match(/<foreignObject/g) || [];
    expect(isolatedNodes.length).toBe(2);
    const edgesGroup = svgIsolated.substring(svgIsolated.indexOf('<g class="edges">'), svgIsolated.indexOf('</g>'));
    const pathMatches = edgesGroup.match(/<path d="M/g) || [];
    expect(pathMatches.length).toBe(1);
  });

  describe('ringScope and edgeStyle configurations in dimmed mode', () => {
    const ringEmail = `box-shadow:0 0 0 2px ${GRAPH_STYLE.colors.node.email.dark.ring}`;
    const ringAccount = `box-shadow:0 0 0 2px ${GRAPH_STYLE.colors.node.account.dark.ring}`;
    const dimmedEdgeStroke = `stroke="${GRAPH_STYLE.colors.edge.dimmed}"`;
    const dimmedEdgeOpacity = `opacity="${GRAPH_STYLE.opacity.dimmed}"`;

    const edgeStylePairs: Array<{
      edgeStyle: 'normal' | 'dashed' | 'highlighted';
      edgeStyleApplyTo: 'all' | 'selected' | 'nonSelected';
      expectedFocusedEdgeStroke: string;
      expectedFocusedEdgeDash: boolean;
      expectedFocusedEdgeWidth: number;
    }> = [
      {
        edgeStyle: 'highlighted',
        edgeStyleApplyTo: 'all',
        expectedFocusedEdgeStroke: GRAPH_STYLE.colors.edge.highlightDark,
        expectedFocusedEdgeDash: false,
        expectedFocusedEdgeWidth: GRAPH_STYLE.strokeWidth.highlighted,
      },
      {
        edgeStyle: 'dashed',
        edgeStyleApplyTo: 'all',
        expectedFocusedEdgeStroke: GRAPH_STYLE.colors.edge.highlightDark,
        expectedFocusedEdgeDash: true,
        expectedFocusedEdgeWidth: GRAPH_STYLE.strokeWidth.highlighted,
      },
      {
        edgeStyle: 'normal',
        edgeStyleApplyTo: 'all',
        expectedFocusedEdgeStroke: GRAPH_STYLE.colors.edge.baseDark,
        expectedFocusedEdgeDash: false,
        expectedFocusedEdgeWidth: GRAPH_STYLE.strokeWidth.base,
      },
    ];

    const ringScopes: Array<'all' | 'selected' | 'none'> = ['all', 'selected', 'none'];

    ringScopes.forEach((ringScope) => {
      edgeStylePairs.forEach(({ edgeStyle, edgeStyleApplyTo, expectedFocusedEdgeStroke, expectedFocusedEdgeDash, expectedFocusedEdgeWidth }) => {
        it(`renders correctly for ringScope="${ringScope}" × edgeStyle="${edgeStyle}"/applyTo="${edgeStyleApplyTo}"`, () => {
          useGraphStore.setState({
            selectedNodeIds: new Set(),
            selectedEdgeIds: new Set(),
            activeChain: {
              nodeIds: new Set(['node-1', 'node-2']), // node-1 root, node-2 neighbor
              edgeIds: new Set(['edge-1']),           // edge-1 neighborEdge
            },
          });

          const svg = graphToSvgString(mockFlowNodes, mockFlowEdges, 'dimmed', {
            theme: 'dark',
            ringScope,
            edgeStyle,
            edgeStyleApplyTo,
          });

          // 1. Assert Dimmed-set edge (edge-2) is ALWAYS untouched with standard dimmed styling
          expect(svg).toContain(dimmedEdgeStroke);
          expect(svg).toContain(dimmedEdgeOpacity);
          expect(svg).toContain(`filter="blur(${GRAPH_STYLE.blur.dimmed})"`);

          // 2. Assert Ring placements according to ringScope
          if (ringScope === 'all') {
            expect(svg).toContain(ringEmail);   // root (node-1)
            expect(svg).toContain(ringAccount); // neighbor (node-2)
          } else if (ringScope === 'selected') {
            expect(svg).toContain(ringEmail);       // root (node-1)
            expect(svg).not.toContain(ringAccount); // neighbor (node-2) has no ring
          } else {
            // 'none'
            expect(svg).not.toContain(ringEmail);
            expect(svg).not.toContain(ringAccount);
          }

          // 3. Assert Focused edge (edge-1) styling
          expect(svg).toContain(`stroke="${expectedFocusedEdgeStroke}"`);
          expect(svg).toContain(`stroke-width="${expectedFocusedEdgeWidth}"`);
          if (expectedFocusedEdgeDash) {
            expect(svg).toContain('stroke-dasharray="5 5"');
          }
        });
      });
    });
  });
});
