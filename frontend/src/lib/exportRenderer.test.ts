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

    const match = svg.match(/<g class="nodes">([\s\S]*?)<\/g>\s*<\/svg>/);
    console.log('--- DUAL PILL SVG NODE MARKUP ---');
    console.log(match ? match[1].trim() : svg);
    console.log('--- END DUAL PILL SVG NODE MARKUP ---');
  });
});
