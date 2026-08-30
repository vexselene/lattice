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
  });

  it('renders full graph in "dimmed" mode with activeChain highlighted and rest dimmed', () => {
    const svg = graphToSvgString(mockFlowNodes, mockFlowEdges, 'dimmed', { theme: 'dark' });

    // Should include all 3 nodes
    const foreignObjectMatches = svg.match(/<foreignObject/g) || [];
    expect(foreignObjectMatches.length).toBe(3);

    // Dimmed style token check (opacity: 0.3)
    expect(svg).toContain(`opacity:${GRAPH_STYLE.opacity.dimmed}`);
  });

  it('renders ONLY selected nodes and 0 edges in "isolated" mode when selected nodes are not adjacent', () => {
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
});
