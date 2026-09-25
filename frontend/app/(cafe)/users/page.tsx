"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const canManageUsers = hasPermission("users.manage");
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: api.users.list, enabled: canManageUsers });
  const roles = useQuery({ queryKey: ["user-roles"], queryFn: api.users.roles, enabled: canManageUsers });
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", roleId: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const createUser = useMutation({
    mutationFn: (input: typeof form) => editingId
      ? api.users.update(editingId, { name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim() || undefined, roleId: input.roleId })
      : api.users.create({ ...input, name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim() || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setForm((current) => ({ ...current, name: "", email: "", phone: "", password: "" }));
      setEditingId(null);
    },
  });
  const deactivateUser = useMutation({ mutationFn: api.users.deactivate, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }) });
  const setUserActive = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.users.setActive(id, isActive), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }) });
  const changePassword = useMutation({ mutationFn: ({ id, password }: { id: string; password: string }) => api.users.changePassword(id, password), onSuccess: () => { setPasswordUserId(null); setNewPassword(""); } });

  useEffect(() => {
    const availableRoles = roles.data;
    if (!form.roleId && availableRoles?.length) {
      const preferred = availableRoles.find((role) => ["WAITER", "CASHIER"].includes(role.name.toUpperCase()));
      setForm((current) => ({ ...current, roleId: (preferred ?? availableRoles[0]).id }));
    }
  }, [form.roleId, roles.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createUser.mutate(form);
  }

  if (!canManageUsers) return <section className="card"><h1 className="page-title">Access denied</h1><p className="muted">You don’t have permission to manage cafe users.</p></section>;

  return (
    <section className="user-management">
      <header className="user-management-header">
        <div><p className="eyebrow">CAFE TEAM</p><h1 className="page-title">Users</h1><p className="muted">Create staff accounts so each person can sign in with their own role.</p></div>
      </header>

      <div className="user-management-grid">
        <form className="card user-create-form" onSubmit={submit}>
          <h2>{editingId ? "Edit user" : "Create a user"}</h2>
          <label className="field">Full name<input autoComplete="name" onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></label>
          <label className="field">Email<input autoComplete="email" onChange={(event) => setForm({ ...form, email: event.target.value })} required type="email" value={form.email} /></label>
          <label className="field">Phone <span className="muted">(optional)</span><input autoComplete="tel" onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} /></label>
          <label className="field">Role<select onChange={(event) => setForm({ ...form, roleId: event.target.value })} required value={form.roleId}>
            <option disabled value="">Select a role</option>
            {roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name.replaceAll("_", " ")}</option>)}
          </select></label>
          {!editingId && <label className="field">Temporary password<input autoComplete="new-password" minLength={8} onChange={(event) => setForm({ ...form, password: event.target.value })} required type="password" value={form.password} /><span className="muted">At least 8 characters.</span></label>}
          {roles.isLoading && <p className="muted" role="status">Loading roles…</p>}
          {roles.error && <p className="error" role="alert">Unable to load roles. Check that roles are configured for this cafe.</p>}
          {createUser.error && <p className="error" role="alert">{createUser.error.message}</p>}
          {createUser.isSuccess && <p className="user-success" role="status">User created. They can now sign in from the main login page.</p>}
          {createUser.error && <p className="error" role="alert">{createUser.error.message}</p>}
          <div className="form-row"><button className="btn" disabled={createUser.isPending || roles.isLoading || !form.roleId} type="submit">{createUser.isPending ? "Saving…" : editingId ? "Save user" : "Create user"}</button>{editingId && <button className="btn secondary" onClick={() => { setEditingId(null); setForm({ name: "", email: "", phone: "", password: "", roleId: roles.data?.[0]?.id ?? "" }); }} type="button">Cancel edit</button>}</div>
        </form>

        <section className="card user-list-card">
          <div className="user-list-heading"><div><h2>Team accounts</h2><p className="muted">Staff with access to this cafe.</p></div><span className="tag">{users.data?.length ?? 0} users</span></div>
          {users.isLoading && <p className="muted" role="status">Loading users…</p>}
          {users.error && <p className="error" role="alert">Unable to load users. Please refresh and try again.</p>}
          {!users.isLoading && !users.error && !users.data?.length && <p className="empty">No staff accounts yet. Create the first account using the form.</p>}
          {!!users.data?.length && <div className="user-table-wrap"><table className="table user-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {users.data.map((user) => { const membership = user.memberships[0]; return <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{membership?.role.name.replaceAll("_", " ") ?? "—"}</td><td><span className={`user-status ${membership?.isActive && user.isActive ? "active" : "inactive"}`}>{membership?.isActive && user.isActive ? "Active" : "Inactive"}</span></td><td><div className="form-row"><button className="btn secondary" onClick={() => { setEditingId(user.id); setForm({ name: user.name, email: user.email, phone: user.phone ?? "", password: "", roleId: membership?.role.id ?? "" }); }} type="button">Edit</button><button className="btn secondary" onClick={() => setPasswordUserId(passwordUserId === user.id ? null : user.id)} type="button">Change password</button>{membership?.isActive ? <button className="btn secondary" onClick={() => { if (window.confirm(`Deactivate ${user.name}'s access to this cafe?`)) deactivateUser.mutate(user.id); }} type="button">Delete</button> : <button className="btn secondary" onClick={() => setUserActive.mutate({ id: user.id, isActive: true })} type="button">Reactivate</button>}</div>{passwordUserId === user.id && <form className="form-row" onSubmit={(event) => { event.preventDefault(); changePassword.mutate({ id: user.id, password: newPassword }); }}><input autoComplete="new-password" aria-label={`New password for ${user.name}`} minLength={8} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /><button className="btn" disabled={changePassword.isPending} type="submit">Save password</button></form>}</td></tr>; })}
          </tbody></table></div>}
          {(deactivateUser.error || setUserActive.error || changePassword.error) && <p className="error" role="alert">{deactivateUser.error?.message || setUserActive.error?.message || changePassword.error?.message}</p>}
        </section>
      </div>
    </section>
  );
}
