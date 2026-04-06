"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const trapStatusColors: Record<string, string> = {
  active: "#16a34a",
  inactive: "#9ca3af",
  damaged: "#f59e0b",
  removed: "#ef4444",
};

interface Trap {
  id: string;
  label: string;
  latitude: string;
  longitude: string;
  status: string;
  trapType: string;
}

interface SiteMapProps {
  center?: { lat: number; lng: number };
  traps?: Trap[];
  onMapClick?: (lat: number, lng: number) => void;
  onTrapClick?: (trapId: string) => void;
  selectedTrapId?: string;
  height?: string;
  showClickMarker?: { lat: number; lng: number } | null;
}

export function SiteMap({
  center,
  traps = [],
  onMapClick,
  onTrapClick,
  selectedTrapId,
  height = "400px",
  showClickMarker,
}: SiteMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const clickMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const defaultCenter = center ?? { lat: 60.1699, lng: 24.9384 }; // Helsinki default
    const map = L.map(containerRef.current).setView(
      [defaultCenter.lat, defaultCenter.lng],
      center ? 16 : 6
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (onMapClick) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update trap markers
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    traps.forEach((trap) => {
      const lat = parseFloat(trap.latitude);
      const lng = parseFloat(trap.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const color = trapStatusColors[trap.status] ?? "#6b7280";
      const isSelected = trap.id === selectedTrapId;

      const icon = L.divIcon({
        className: "custom-trap-marker",
        html: `<div style="
          width: ${isSelected ? "20px" : "14px"};
          height: ${isSelected ? "20px" : "14px"};
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          ${isSelected ? "outline: 3px solid " + color + "40;" : ""}
        "></div>`,
        iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
        iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(
        markersRef.current!
      );
      marker.bindTooltip(trap.label, { direction: "top", offset: [0, -10] });

      if (onTrapClick) {
        marker.on("click", () => onTrapClick(trap.id));
      }
    });

    // Fit bounds if we have traps
    if (traps.length > 0 && mapRef.current) {
      const coords = traps
        .map((t) => [parseFloat(t.latitude), parseFloat(t.longitude)] as [number, number])
        .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      }
    }
  }, [traps, selectedTrapId, onTrapClick]);

  // Click marker for trap placement
  useEffect(() => {
    if (!mapRef.current) return;

    if (clickMarkerRef.current) {
      clickMarkerRef.current.remove();
      clickMarkerRef.current = null;
    }

    if (showClickMarker) {
      clickMarkerRef.current = L.marker(
        [showClickMarker.lat, showClickMarker.lng],
        { icon: defaultIcon }
      ).addTo(mapRef.current);
    }
  }, [showClickMarker]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-lg border border-gray-200"
    />
  );
}
