import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, User } from '../models/user.model';

const TOKEN_KEY = 'verifai.token';
const USER_KEY = 'verifai.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _currentUser$ = new BehaviorSubject<User | null>(
    this.loadUser(),
  );
  readonly currentUser$: Observable<User | null> =
    this._currentUser$.asObservable();

  get currentUser(): User | null {
    return this._currentUser$.value;
  }

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  get isAuthenticated(): boolean {
    return !!this.token && !!this.currentUser;
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, {
        username,
        password,
      })
      .pipe(tap((res) => this.persist(res)));
  }

  register(
    email: string,
    password: string,
    displayName: string,
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, {
        email,
        password,
        displayName,
      })
      .pipe(tap((res) => this.persist(res)));
  }

  logout(): Observable<void> {
    return new Observable<void>((sub) => {
      this.http
        .post<void>(`${environment.apiBaseUrl}/auth/logout`, {})
        .subscribe({
          next: () => {
            this.clear();
            sub.next();
            sub.complete();
          },
          error: () => {
            // Even if blacklist call fails, clear local state.
            this.clear();
            sub.next();
            sub.complete();
          },
        });
    });
  }

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    this._currentUser$.next(null);
  }

  private persist(res: AuthResponse): void {
    try {
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch {
      // ignore quota / disabled storage
    }
    this._currentUser$.next(res.user);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
