"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function OrganizationSettingsForm() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const [settings, setSettings] = useState({ businessName: "", address: "", phone: "", email: "" });
  const mutation = useMutation({
    mutationFn: () => api.settings.update(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings"], next);
      setSettings({ businessName: next.businessName, address: next.address ?? "", phone: next.phone ?? "", email: next.email ?? "" });
    },
  });

  useEffect(() => {
    if (query.data) setSettings({ businessName: query.data.businessName, address: query.data.address ?? "", phone: query.data.phone ?? "", email: query.data.email ?? "" });
  }, [query.data]);

  const update = (field: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <section className="organization-settings-page">
      <header>
        <p className="eyebrow">ORGANIZATION</p>
        <h1 className="page-title">Cafe setup</h1>
        <p className="muted">These details appear in the admin sidebar and on printed bills.</p>
      </header>

      <form className="card organization-settings-form" onSubmit={submit}>
        <label className="field">Cafe name<input onChange={(event) => update("businessName", event.target.value)} placeholder="e.g. Sajha Cafe" required value={settings.businessName} /></label>
        <label className="field">Address<input onChange={(event) => update("address", event.target.value)} placeholder="Street, city, area" value={settings.address} /></label>
        <div className="organization-settings-row">
          <label className="field">Phone<input autoComplete="tel" onChange={(event) => update("phone", event.target.value)} placeholder="Contact phone" value={settings.phone} /></label>
          <label className="field">Email<input autoComplete="email" onChange={(event) => update("email", event.target.value)} placeholder="Contact email" type="email" value={settings.email} /></label>
        </div>
        {query.error && <p className="error" role="alert">Unable to load cafe settings.</p>}
        {mutation.isSuccess && <p className="organization-settings-saved" role="status">Cafe setup saved.</p>}
        {mutation.error && <p className="error" role="alert">Unable to save cafe settings.</p>}
        <button className="btn" disabled={query.isLoading || mutation.isPending} type="submit">{mutation.isPending ? "Saving…" : "Save cafe setup"}</button>
      </form>
    </section>
  );
}
