export type LoginPayload = {
  username: string;
  password: string;
};

export type AuthState = {
  isAuthenticated: boolean;
  username?: string;
};
