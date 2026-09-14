import { describe, it, expect } from 'vitest';
import { graphToSvgString } from './exportRenderer';
import { Node as FlowNode } from '@xyflow/react';

describe('exportRenderer dual-pill', () => {
  it('renders dual-pill SVG markup for account node with service', () => {
    const nodes: FlowNode[] = [
      {
        id: 'acc-1',
        type: 'account',
        position: { x: 50, y: 100 },
        data: {
          id: 'acc-1',
          username: 'johndoe',
          service_id: 'srv-1',
          service_name: 'GitHub',
          service_color: '#10B981',
        } as any,
      },
    ];
    const edges: any[] = [];

    const svg = graphToSvgString(nodes, edges, 'all', { theme: 'dark' });
    expect(svg).toContain('GitHub');
    expect(svg).toContain('johndoe');
    expect(svg).toContain('#10B981');

  });

  it('renders a 16:9 blank canvas with minimum dimensions when no nodes are included', () => {
    const svg = graphToSvgString([], [], 'isolated', { theme: 'dark' });
    expect(svg).toContain('width="960"');
    expect(svg).toContain('height="540"');
    expect(svg).toContain('viewBox="0 0 960 540"');
    expect(svg).toContain('<g class="nodes">\n    \n  </g>');
  });

  it('dims all nodes and edges when mode is dimmed and nothing is selected', () => {
    const nodes: FlowNode[] = [
      {
        id: 'acc-1',
        type: 'account',
        position: { x: 50, y: 100 },
        data: { id: 'acc-1', username: 'alice' } as any,
      },
    ];
    const edges: any[] = [];
    const svg = graphToSvgString(nodes, edges, 'dimmed', { theme: 'dark' });
    expect(svg).toContain('opacity="0.3"');
  });

  it('starts edge at the right handle of the expanded service pill', () => {
    const nodes: FlowNode[] = [
      {
        id: 'acc-1',
        type: 'account',
        position: { x: 50, y: 100 },
        data: {
          id: 'acc-1',
          username: 'johndoe',
          service_id: 'srv-1',
          service_name: 'GitHub',
          service_color: '#10B981',
        } as any,
      },
      {
        id: 'tgt-1',
        type: 'email',
        position: { x: 500, y: 100 },
        data: { id: 'tgt-1', address: 'alice@example.com' } as any,
      },
    ];
    const edges: any[] = [
      {
        id: 'edge-1',
        source: 'acc-1',
        target: 'tgt-1',
        data: { relation: 'registered_with' },
      },
    ];

    const svg = graphToSvgString(nodes, edges, 'all', { theme: 'dark' });
    const edgePathMatch = svg.match(/<g class="edges">[\s\S]*?<path d="M([0-9.]+)[ ,]([0-9.]+)/);
    expect(edgePathMatch).not.toBeNull();
    const sourceX = parseFloat(edgePathMatch![1]);

    // acc-1 is rendered at 164, and its dual-pill width is 158
    // The edge starts exactly at 164 + 158 = 322 (right handle of the expanded service pill)
    expect(sourceX).toBe(322);
  });

  it('generates valid xml with special characters in user input', () => {
    const nodes: FlowNode[] = [
      {
        id: 'node-1',
        type: 'account',
        position: { x: 0, y: 0 },
        data: {
          username: 'test"<>',
          service_name: 'serv"<>',
          service_color: '"> <bad_tag/> '
        } as any
      }
    ];
    const svg = graphToSvgString(nodes, [], 'all', { theme: 'dark' });
    expect(svg).not.toContain('<bad_tag/>');
  });
});

