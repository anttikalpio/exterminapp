"use client";

import { useEffect, useState } from "react";

export type GeocodeStatus =
  | "idle"
  | "loading"
  | "found"
  | "not_found"
  | "error";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface GeocodeState {
  result: GeocodeResult | null;
  status: GeocodeStatus;
}

/**
 * Geocode an address string using Nominatim (OpenStreetMap).
 *
 * Debounces the input so we don't hammer the public endpoint on every
 * keystroke, and aborts in-flight requests when the query changes. Returns
 * "idle" for empty / too-short inputs so the UI can hide the status badge.
 */
export function useGeocode(
  address: string,
  debounceMs = 800
): GeocodeState {
  const [state, setState] = useState<GeocodeState>({
    result: null,
    status: "idle",
  });

  useEffect(() => {
    const trimmed = address.trim();
    if (trimmed.length < 5) {
      setState({ result: null, status: "idle" });
      return;
    }

    // Show the loading indicator immediately so the user sees feedback
    // while they keep typing.
    setState({ result: null, status: "loading" });

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url =
          "https://nominatim.openstreetmap.org/search" +
          `?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept-Language": "en" },
        });
        if (!res.ok) {
          setState({ result: null, status: "error" });
          return;
        }
        const data = (await res.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
        }>;
        if (!Array.isArray(data) || data.length === 0) {
          setState({ result: null, status: "not_found" });
          return;
        }
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        if (isNaN(lat) || isNaN(lng)) {
          setState({ result: null, status: "not_found" });
          return;
        }
        setState({
          result: { lat, lng, displayName: first.display_name },
          status: "found",
        });
      } catch (err) {
        // Abort is expected when the user keeps typing — ignore it.
        if ((err as { name?: string })?.name === "AbortError") return;
        setState({ result: null, status: "error" });
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, debounceMs]);

  return state;
}
