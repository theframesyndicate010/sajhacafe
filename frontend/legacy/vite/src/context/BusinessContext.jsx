import React, { useEffect, useMemo, useState, useCallback } from "react";

import { apiClient } from "../services/apiClient.js";
import { BusinessContext } from "./business-context.js";

const STORAGE_KEY = "sajha-karobar-active-business";

export function BusinessProvider({ children }) {
  const [businesses, setBusinesses] = useState([]);
  const [activeBusinessId, setActiveBusinessIdInternal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageProvider, setStorageProvider] = useState("json");
  const isInitialLoadRef = React.useRef(true);

  /**
   * Load active business ID from storage based on provider
   * @returns {Promise<string|null>} The stored business ID or null
   */
  const loadActiveBusinessId = useCallback(async () => {
    if (storageProvider === "supabase") {
      try {
        const preferences = await apiClient.getPreferences();
        return preferences.data?.activeBusinessId || preferences.activeBusinessId || null;
      } catch (err) {
        console.error("Failed to load preferences from Supabase:", err);
        // Fallback to localStorage on Supabase failure
        return localStorage.getItem(STORAGE_KEY);
      }
    } else {
      // JSON mode: use localStorage
      return localStorage.getItem(STORAGE_KEY);
    }
  }, [storageProvider]);

  /**
   * Save active business ID to storage based on provider
   * Includes migration logic: if provider is "supabase" and localStorage has data, migrate to Supabase
   * @param {string} id - The business ID to save
   * @returns {Promise<void>}
   */
  const saveActiveBusinessId = useCallback(async (id) => {
    if (storageProvider === "supabase") {
      try {
        // Check if we need to migrate from localStorage
        const localStorageValue = localStorage.getItem(STORAGE_KEY);
        
        // Save to Supabase
        await apiClient.updatePreferences({ activeBusinessId: id });
        
        // If migration occurred (localStorage had data), clear it after successful Supabase save
        if (localStorageValue !== null) {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        console.error("Failed to save preferences to Supabase:", err);
        // Fallback to localStorage on Supabase failure
        localStorage.setItem(STORAGE_KEY, id);
      }
    } else {
      // JSON mode: use localStorage
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, [storageProvider]);

  // Wrapper function that marks the end of initial load and saves to storage
  const setActiveBusinessId = useCallback((id) => {
    isInitialLoadRef.current = false;
    setActiveBusinessIdInternal(id);
    // Save immediately when user explicitly sets the business ID
    saveActiveBusinessId(id);
  }, [saveActiveBusinessId]);

  useEffect(() => {
    const detectStorageProvider = async () => {
      try {
        const healthResponse = await apiClient.getHealth();
        const provider = healthResponse.provider || "json";
        setStorageProvider(provider);
      } catch {
        // If health check fails, default to json mode
        setStorageProvider("json");
      }
    };

    detectStorageProvider();
  }, []);

  useEffect(() => {
    const loadBusinesses = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiClient.getBusinesses();
        const fetchedBusinesses = response.data || [];

        setBusinesses(fetchedBusinesses);

        const storedBusinessId = await loadActiveBusinessId();
        const matchedStored = fetchedBusinesses.find((item) => item.id === storedBusinessId);

        if (matchedStored) {
          setActiveBusinessIdInternal(matchedStored.id);
        } else if (fetchedBusinesses[0]) {
          setActiveBusinessIdInternal(fetchedBusinesses[0].id);
        }
      } catch (loadError) {
        setError(loadError.message || "Failed to load businesses");
      } finally {
        setLoading(false);
      }
    };

    loadBusinesses();
  }, [storageProvider, loadActiveBusinessId]);

  const activeBusiness = useMemo(
    () => businesses.find((item) => item.id === activeBusinessId) || null,
    [activeBusinessId, businesses],
  );

  const value = {
    businesses,
    activeBusiness,
    activeBusinessId,
    setActiveBusinessId,
    loading,
    error,
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}
