export interface AuthOrgMembership {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  orgs: AuthOrgMembership[];
}

export interface AuthResponse {
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}
