"use client";

import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return <div className="waiter-page"><p className="eyebrow">ACCOUNT</p><h1>Profile</h1><article className="card waiter-profile"><div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><h2>{user.name}</h2><p className="muted">{user.email}</p><span className="status-pill">{user.role}</span><p className="muted">{user.tenant.name}</p></div></article></div>;
}
