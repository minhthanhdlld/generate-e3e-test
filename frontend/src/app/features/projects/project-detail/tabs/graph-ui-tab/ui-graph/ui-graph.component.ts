import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { Graph, GraphNode } from '../../../../../../core/models/crawl.model';

@Component({
  selector: 'app-ui-graph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-graph.component.html',
  styleUrls: ['./ui-graph.component.css'],
})
export class UiGraphComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() graph: Graph | null = null;
  @Output() nodeSelected = new EventEmitter<GraphNode>();

  @ViewChild('graphHost', { static: true })
  graphHost!: ElementRef<HTMLDivElement>;

  private cy?: Core;

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] && this.graphHost) {
      this.render();
    }
  }

  private render(): void {
    if (this.cy) {
      this.cy.destroy();
      this.cy = undefined;
    }
    if (!this.graph) return;

    const elements: ElementDefinition[] = [
      ...this.graph.nodes.map((n) => ({
        data: { id: n.id, label: n.label || n.url, kind: n.kind, raw: n },
      })),
      ...this.graph.edges.map((e) => ({
        data: { id: e.id, source: e.from, target: e.to, label: e.label },
      })),
    ];

    this.cy = cytoscape({
      container: this.graphHost.nativeElement,
      elements,
      layout: { name: 'breadthfirst', directed: true, padding: 24, spacingFactor: 1.4, nodeDimensionsIncludeLabels: true },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#475569',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': 10,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '200px',
            'text-margin-y': 4,
            width: 36,
            height: 36,
            'border-width': 0,
          },
        },
        {
          selector: 'node[kind = "entry"]',
          style: { 'background-color': '#4f46e5' },
        },
        {
          selector: 'node[kind = "failed"]',
          style: { 'background-color': '#e11d48' },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'font-size': 9,
            label: 'data(label)',
            color: '#64748b',
          },
        },
      ],
    });

    this.cy.on('tap', 'node', (evt) => {
      const raw = evt.target.data('raw') as GraphNode | undefined;
      if (raw) this.nodeSelected.emit(raw);
    });
  }

  ngOnDestroy(): void {
    this.cy?.destroy();
    this.cy = undefined;
  }
}
