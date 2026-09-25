"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { OrganizationFooter } from "@/components/common/organization-footer";
import { api } from "@/lib/api/client";
import { authQueryKey, getWorkspacePath } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function submitLogin(values: LoginForm) {
    setServerError("");

    try {
      const user = await api.auth.login(values);
      queryClient.setQueryData(authQueryKey, user);
      router.replace(getWorkspacePath(user));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to sign in.");
    }
  }

  return (
    <main className="login">
      <form className="login-card" method="post" onSubmit={handleSubmit(submitLogin)}>
        <h1 className="page-title">Welcome back</h1>
        <p className="muted">Sign in to manage your cafe.</p>

        <label className="field">
          Email
          <input autoComplete="email" placeholder="you@cafe.com" {...register("email")} />
          {errors.email && <span className="error">{errors.email.message}</span>}
        </label>

        <label className="field">
          Password
          <input autoComplete="current-password" type="password" {...register("password")} />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </label>

        {serverError && <p className="error">{serverError}</p>}

        <button className="btn" disabled={isSubmitting} style={{ width: "100%" }} type="submit">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

      </form>
      <OrganizationFooter />
    </main>
  );
}
