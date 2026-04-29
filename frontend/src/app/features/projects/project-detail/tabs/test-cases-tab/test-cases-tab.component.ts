import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  TestCaseRecord,
  TestCasesApiService,
} from '../../../../../core/services/test-cases.service';

@Component({
  selector: 'app-test-cases-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test-cases-tab.component.html',
  styleUrls: ['./test-cases-tab.component.css'],
})
export class TestCasesTabComponent implements OnInit, OnDestroy {
  @Input({ required: true }) projectId!: string;

  private readonly api = inject(TestCasesApiService);
  private subs: Subscription[] = [];

  record: TestCaseRecord | null = null;
  loading = true;
  generating = false;
  errorMsg = '';
  promptCopied = false;
  resultCopied = false;
  copiedTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.subs.push(
      this.api.latest(this.projectId).subscribe({
        next: (r) => {
          this.record = r;
          this.loading = false;
        },
        error: (err) => {
          this.errorMsg = err?.error?.message ?? 'Failed to load latest record';
          this.loading = false;
        },
      }),
    );
  }

  generate(): void {
    this.generating = true;
    this.errorMsg = '';
    this.subs.push(
      this.api.generate(this.projectId).subscribe({
        next: (r) => {
          this.record = r;
          this.generating = false;
        },
        error: (err) => {
          this.errorMsg = err?.error?.message ?? 'Failed to generate';
          this.generating = false;
        },
      }),
    );
  }

  copyPrompt(): void {
    if (!this.record?.promptText) return;
    void navigator.clipboard.writeText(this.record.promptText).then(() => {
      this.promptCopied = true;
      this.scheduleClear('prompt');
    });
  }

  copyResult(): void {
    if (!this.record?.generatedResult) return;
    void navigator.clipboard.writeText(this.record.generatedResult).then(() => {
      this.resultCopied = true;
      this.scheduleClear('result');
    });
  }

  private scheduleClear(which: 'prompt' | 'result'): void {
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      if (which === 'prompt') this.promptCopied = false;
      else this.resultCopied = false;
    }, 1500);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
  }
}
