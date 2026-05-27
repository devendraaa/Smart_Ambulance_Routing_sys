"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { DispatchCase } from "@/lib/dispatch";
import { getFullRoute } from "@/lib/api";
import { Map, Loader2 } from "lucide-react";

interface Props {
  selectedCase: DispatchCase | null;
}

export default function DispatchMap({ selectedCase }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletLoaded = useRef(false);
  const [loading, setLoading] = useState(false);

  const loadLeaflet = useCallback(async () => {
    if (leafletLoaded.current && typeof window !== "undefined" && (window as any).L) return (window as any).L;

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const LModule = await import("leaflet");
    const L = LModule.default || LModule;
    (window as any).L = L;
    leafletLoaded.current = true;
    return L;
  }, []);

  useEffect(() => {
    if (!selectedCase || !mapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      setLoading(true);
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        mapRef.current.innerHTML = "";

        const map = L.map(mapRef.current, {
          center: [19.0760, 72.8777],
          zoom: 12,
        });
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        map.invalidateSize();

        const allLatLngs: [number, number][] = [];

        // Fetch route coordinates
        try {
          const fullData = await getFullRoute(selectedCase.task_id);
          if (cancelled) return;
          const coords = fullData.coordinates;
          if (coords.length > 0) {
            const latlngs: [number, number][] = coords.map((c) => [c.lat, c.lon]);
            L.polyline(latlngs, { color: "#2563eb", weight: 5, opacity: 0.8, lineCap: "round", lineJoin: "round" }).addTo(map);
            latlngs.forEach((ll) => allLatLngs.push(ll));

            // Turn points
            const turns = fullData.turn_points;
            if (turns.length > 0) {
              turns.forEach((t: any) => {
                L.circleMarker([t.lat, t.lon], {
                  radius: 6, color: "#ea580c", fillColor: "#f97316", fillOpacity: 0.9, weight: 2,
                }).addTo(map);
                allLatLngs.push([t.lat, t.lon]);
              });
            }
          }
        } catch {
          // route not computed yet — just show markers
        }

        // Start marker (origin)
        const origin = L.divIcon({
          html: `<div style="background:#10b981;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">S</div>`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        });
        L.marker([selectedCase.origin_lat, selectedCase.origin_lon], { icon: origin })
          .addTo(map).bindPopup(`<b>Origin</b><br/>${selectedCase.patient_name || ""}`);
        allLatLngs.push([selectedCase.origin_lat, selectedCase.origin_lon]);

        // Hospital marker (destination)
        if (selectedCase.hospital_lat && selectedCase.hospital_lon) {
          const dest = L.divIcon({
            html: `<div style="background:#ef4444;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">H</div>`,
            iconSize: [20, 20], iconAnchor: [10, 10],
          });
          L.marker([selectedCase.hospital_lat, selectedCase.hospital_lon], { icon: dest })
            .addTo(map).bindPopup(`<b>${selectedCase.hospital_name}</b>`);
          allLatLngs.push([selectedCase.hospital_lat, selectedCase.hospital_lon]);
        }

        // Ambulance marker (live GPS)
        if (selectedCase.current_lat != null && selectedCase.current_lon != null) {
          const ambIcon = L.divIcon({
            html: `<div style="position:relative;">
              <div style="background:#3b82f6;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">A</div>
              <div style="position:absolute;top:-5px;left:-5px;width:32px;height:32px;border-radius:50%;background:rgba(59,130,246,0.3);animation:pulse 2s infinite;"></div>
              <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0}}</style>
            </div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
          });
          L.marker([selectedCase.current_lat, selectedCase.current_lon], { icon: ambIcon })
            .addTo(map).bindPopup(`<b>Ambulance</b><br/>Lat: ${selectedCase.current_lat.toFixed(5)}<br/>Lon: ${selectedCase.current_lon.toFixed(5)}`);
          allLatLngs.push([selectedCase.current_lat, selectedCase.current_lon]);
        }

        // Fit bounds
        requestAnimationFrame(() => {
          if (cancelled) return;
          map.invalidateSize();
          if (allLatLngs.length > 0) {
            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [60, 60] });
          } else {
            map.setView([19.0760, 72.8777], 12);
          }
        });

        // Legend
        const legend = L.control({ position: "topright" });
        legend.onAdd = function () {
          const div = document.createElement("div");
          div.className = "bg-white rounded-xl shadow-lg border border-gray-200 p-3 text-xs space-y-1.5";
          div.innerHTML = `
            <div class="font-bold text-gray-700 mb-1">Legend</div>
            <div class="flex items-center gap-2"><div class="w-8 h-1.5 rounded-full" style="background:#2563eb"></div><span class="text-gray-600">Route</span></div>
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#10b981;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Origin</span></div>
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Hospital</span></div>
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#3b82f6;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Ambulance</span></div>`;
          return div;
        };
        legend.addTo(map);
      } catch (err) {
        console.error("Dispatch map error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initMap();
    return () => { cancelled = true; };
  }, [selectedCase, loadLeaflet]);

  if (!selectedCase) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl">
        <div className="text-center text-gray-400">
          <Map className="w-12 h-12 mx-auto mb-3" />
          <p className="text-sm">Select a case to view route</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}
      <div ref={mapRef} className="h-full w-full rounded-2xl overflow-hidden" />
    </div>
  );
}
