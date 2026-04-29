import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphNode } from '../../../../../../core/models/crawl.model';

@Component({
  selector: 'app-ui-graph-node-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-graph-node-drawer.component.html',
  styleUrls: ['./ui-graph-node-drawer.component.css'],
})
export class UiGraphNodeDrawerComponent {
  @Input() node: GraphNode | null = null;
  @Input() screenshotUrl: string | null = null;
  @Output() closed = new EventEmitter<void>();

  get formsCount(): number {
    return ((this.node?.metadata as Record<string, unknown>)?.['forms'] as unknown[] | undefined)?.length ?? 0;
  }

  get buttons(): string[] {
    return ((this.node?.metadata as Record<string, unknown>)?.['buttons'] as string[] | undefined) ?? [];
  }

  get error(): string | null {
    return ((this.node?.metadata as Record<string, unknown>)?.['error'] as string | undefined) ?? null;
  }
}
