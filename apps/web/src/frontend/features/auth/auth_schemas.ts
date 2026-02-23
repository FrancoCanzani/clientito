import { z } from "zod/v4";
import { loginSchema } from "@releaselayer/shared";

export const loginFormSchema = loginSchema.transform((data) => ({
  ...data,
  email: data.email.trim().toLowerCase(),
}));

export const registerFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .transform((data) => ({
  ...data,
  email: data.email.trim().toLowerCase(),
  name: data.name.trim(),
}));
