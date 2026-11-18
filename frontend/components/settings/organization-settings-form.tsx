"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RestaurantSettings } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { PrinterSettings } from "@/components/settings/printer-settings";

/** Mirrors the `businessName` column width and the API's MaxLength check. */
const BUSINESS_NAME_MAX = 150;
/** Mirrors the `taxNumber` column width and the API's MaxLength check. */
const TAX_NUMBER_MAX = 50;

const RESET_OPTIONS = [
  { id: "bills", title: "Bills", detail: "Delete bills, orders, payments, and refunds for this cafe." },
  { id: "menu", title: "Menu", detail: "Deactivate all menu items and categories while preserving past bill details." },
  { id: "tables", title: "Tables", detail: "Remove table setup. Existing orders are kept and detached from tables." },
  { id: "duePayments", title: "Due payments", detail: "Delete open bills and their orders when any balance is outstanding." },
  { id: "inventory", title: "Inventory", detail: "Set every stock quantity to zero and clear stock movement history." },
  { id: "reports", title: "Reports", detail: "Clear sales, payment, purchase, expense, customer due, and stock movement records." },
] as const;

type SettingsFormState = {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  logo: string | null;
};

/** Single mapping from the API shape to the form, so fields cannot drift apart. */
const toFormState = (settings: RestaurantSettings): SettingsFormState => ({
  businessName: settings.businessName,
  address: settings.address ?? "",
  phone: settings.phone ?? "",
  email: settings.email ?? "",
  taxNumber: settings.taxNumber ?? "",
  logo: settings.logo ?? null,
});

export function OrganizationSettingsForm() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const query = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const [settings, setSettings] = useState<SettingsFormState>({ businessName: "", address: "", phone: "", email: "", taxNumber: "", logo: null });
  const [logoError, setLogoError] = useState("");
  const [resetSections, setResetSections] = useState<string[]>([]);
  const resetMutation = useMutation({
    mutationFn: () => api.settings.reset(resetSections),
    onSuccess: async () => {
      setResetSections([]);
      await queryClient.invalidateQueries();
    },
  });
  const mutation = useMutation({
    mutationFn: () => api.settings.update(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings"], next);
      setSettings(toFormState(next));
    },
  });

  useEffect(() => {
    if (query.data) setSettings(toFormState(query.data));
  }, [query.data]);

  const update = (field: keyof SettingsFormState, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
    // Clear a stale failure as soon as the user starts correcting it.
    if (mutation.isError) mutation.reset();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  const resetSelected = () => {
    if (!resetSections.length || resetMutation.isPending) return;
    const names = RESET_OPTIONS.filter(({ id }) => resetSections.includes(id)).map(({ title }) => title).join(", ");
    if (window.confirm(`Permanently reset ${names}? This cannot be undone.`)) resetMutation.mutate();
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
        <label className="field">Cafe name<input maxLength={BUSINESS_NAME_MAX} onChange={(event) => update("businessName", event.target.value)} placeholder="e.g. Sajha Cafe" required value={settings.businessName} /></label>
        <label className="field">Tax / PAN number <span className="muted">(optional)</span><input autoComplete="off" maxLength={TAX_NUMBER_MAX} onChange={(event) => update("taxNumber", event.target.value)} placeholder="e.g. 601234567" value={settings.taxNumber} /></label>
        <label className="field">Address<input onChange={(event) => update("address", event.target.value)} placeholder="Street, city, area" value={settings.address} /></label>
        <div className="organization-settings-row">
          <label className="field">Phone<input autoComplete="tel" onChange={(event) => update("phone", event.target.value)} placeholder="Contact phone" value={settings.phone} /></label>
          <label className="field">Email<input autoComplete="email" onChange={(event) => update("email", event.target.value)} placeholder="Contact email" type="email" value={settings.email} /></label>
        </div>
        {query.error && <p className="error" role="alert">Unable to load cafe settings. {query.error instanceof Error ? query.error.message : ""}</p>}
        {mutation.isSuccess && <p className="organization-settings-saved" role="status">Cafe setup saved.</p>}
        {mutation.error && <p className="error" role="alert">{mutation.error instanceof Error ? mutation.error.message : "Unable to save cafe settings."}</p>}
        <button className="btn" disabled={query.isLoading || mutation.isPending} type="submit">{mutation.isPending ? "Saving…" : "Save cafe setup"}</button>
      </form>
      <PrinterSettings />
      {hasPermission("users.manage") && <section className="card admin-reset-panel" aria-labelledby="admin-reset-heading">
        <header>
          <p className="eyebrow">MAIN ADMIN</p>
          <h2 id="admin-reset-heading">Reset cafe data</h2>
          <p className="muted">Choose each section to reset. These changes apply only to the active cafe.</p>
        </header>
        <div className="admin-reset-options">
          {RESET_OPTIONS.map(({ id, title, detail }) => {
            const checked = resetSections.includes(id);
            return <label className={`admin-reset-option${checked ? " selected" : ""}`} key={id}>
              <input checked={checked} disabled={resetMutation.isPending} onChange={(event) => {
                setResetSections((current) => event.target.checked ? [...current, id] : current.filter((section) => section !== id));
                resetMutation.reset();
              }} type="checkbox" />
              <span className="admin-reset-option-copy"><strong>{title}</strong><span>{detail}</span></span>
            </label>;
          })}
        </div>
        {resetMutation.isSuccess && <p className="organization-settings-saved" role="status">Selected cafe data was reset.</p>}
        {resetMutation.error && <p className="error" role="alert">{resetMutation.error instanceof Error ? resetMutation.error.message : "Unable to reset selected data."}</p>}
        <button className="btn admin-reset-button" disabled={!resetSections.length || resetMutation.isPending} onClick={resetSelected} type="button">{resetMutation.isPending ? "Resetting…" : `Reset selected${resetSections.length ? ` (${resetSections.length})` : ""}`}</button>
      </section>}
    </section>
  );
}
