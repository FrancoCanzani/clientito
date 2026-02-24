export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}
