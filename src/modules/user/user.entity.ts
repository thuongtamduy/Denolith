export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: string;
  phone: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  phone?: string;
}
