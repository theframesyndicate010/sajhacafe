"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function OrganizationSettingsForm() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const [settings, setSettings] = useState({ businessName: "", address: "", phone: "", email: "", logo: null as string | null });
  const [logoError, setLogoError] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.settings.update(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings"], next);
      setSettings({ businessName: next.businessName, address: next.address ?? "", phone: next.phone ?? "", email: next.email ?? "", logo: next.logo ?? null });
    },
  });

  useEffect(() => {
    if (query.data) setSettings({ businessName: query.data.businessName, address: query.data.address ?? "", phone: query.data.phone ?? "", email: query.data.email ?? "", logo: query.data.logo ?? null });
  }, [query.data]);

  const update = (field: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  const selectLogo = (file?: File) => {
    if (!file) return;
    setLogoError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setLogoError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 700 * 1024) {
      setLogoError("Choose an image smaller than 700 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSettings((current) => ({ ...current, logo: reader.result as string }));
    };
    reader.onerror = () => setLogoError("Unable to read this image. Please try another file.");
    reader.readAsDataURL(file);
  };

  return (
    <section className="organization-settings-page">
      <header>
        <p className="eyebrow">ORGANIZATION</p>
        <h1 className="page-title">Cafe setup</h1>
        <p className="muted">These details appear in the admin sidebar and on printed bills.</p>
      </header>

      <form className="card organization-settings-form" onSubmit={submit}>
        <div className="organization-logo-field">
          <label className="field">Cafe logo<input accept="image/png,image/jpeg,image/webp" onChange={(event) => selectLogo(event.target.files?.[0])} type="file" /></label>
          {logoError && <p className="error" role="alert">{logoError}</p>}
          {settings.logo ? <div><img alt="Cafe logo preview" height={96} src={settings.logo} width={96} /><button className="btn secondary" onClick={() => setSettings((current) => ({ ...current, logo: null }))} type="button">Remove logo</button></div> : <p className="muted">No logo uploaded. Maximum file size: 700 KB.</p>}
        </div>
        <label className="field">Cafe name<input onChange={(event) => update("businessName", event.target.value)} placeholder="e.g. Sajha Cafe" required value={settings.businessName} /></label>
        <label className="field">Address<input onChange={(event) => update("address", event.target.value)} placeholder="Street, city, area" value={settings.address} /></label>
        <div className="organization-settings-row">
          <label className="field">Phone<input autoComplete="tel" onChange={(event) => update("phone", event.target.value)} placeholder="Contact phone" value={settings.phone} /></label>
          <label className="field">Email<input autoComplete="email" onChange={(event) => update("email", event.target.value)} placeholder="Contact email" type="email" value={settings.email} /></label>
        </div>
        {query.error && <p className="error" role="alert">Unable to load cafe settings.</p>}
        {mutation.isSuccess && <p className="organization-settings-saved" role="status">Cafe setup saved.</p>}
        {mutation.error && <p className="error" role="alert">{mutation.error instanceof Error ? mutation.error.message : "Unable to save cafe settings."}</p>}
        <button className="btn" disabled={query.isLoading || mutation.isPending} type="submit">{mutation.isPending ? "Saving…" : "Save cafe setup"}</button>
      </form>
    </section>
  );
}
