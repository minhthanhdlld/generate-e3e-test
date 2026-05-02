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

  get anchors(): Array<{ href: string; text: string; displayText?: string; trigger: string }> {
    return ((this.node?.metadata as Record<string, unknown>)?.['anchors'] as Array<{
      href: string;
      text: string;
      displayText?: string;
      trigger: string;
    }> | undefined) ?? [];
  }

  // Anchor's user-facing label: backend already resolves text → target title → href
  // into `displayText`. Fall back gracefully for legacy crawl runs without it.
  anchorLabel(a: { href: string; text: string; displayText?: string }): string {
    if (a.displayText && a.displayText.trim().length > 0) return a.displayText;
    if (a.text && a.text.trim().length > 0) return a.text.trim();
    return a.href;
  }

  get phase(): string | null {
    return ((this.node?.metadata as Record<string, unknown>)?.['phase'] as string | undefined) ?? null;
  }

  get triggerText(): string | null {
    const t = ((this.node?.metadata as Record<string, unknown>)?.['triggerText'] as string | undefined) ?? '';
    return t.length > 0 ? t : null;
  }

  get error(): string | null {
    return ((this.node?.metadata as Record<string, unknown>)?.['error'] as string | undefined) ?? null;
  }
}
