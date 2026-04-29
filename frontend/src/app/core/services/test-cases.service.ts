import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface TestCaseRecord {
  id: string;
  projectId: string;
  promptText: string;
  generatedResult: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class TestCasesApiService {
  private readonly api = inject(ApiService);

  generate(projectId: string): Observable<TestCaseRecord> {
    return this.api.post<TestCaseRecord>(
      `/projects/${projectId}/test-cases/generate`,
      {},
    );
  }

  latest(projectId: string): Observable<TestCaseRecord | null> {
    return this.api.get<TestCaseRecord | null>(
      `/projects/${projectId}/test-cases/latest`,
    );
  }
}
