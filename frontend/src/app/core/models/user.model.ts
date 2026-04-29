export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
