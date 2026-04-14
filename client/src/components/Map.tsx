import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export type LeafletMapLike = {
  remove: () => void;
  panTo: (latlng: unknown) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
};

declare global {
  interface Window {
    L?: any;
  }
}

function loadLeafletAssets() {
  if (window.L) return Promise.resolve(window.L);

  const cssId = "leaflet-cdn-css";
  if (!document.getElementById(cssId)) {
    const link = document.createElement("link");
    link.id = cssId;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  return new Promise<any>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet-cdn="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("Leaflet CDN 載入失敗")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.leafletCdn = "true";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet CDN 載入失敗"));
    document.head.appendChild(script);
  });
}

interface MapViewProps {
  className?: string;
  initialCenter?: LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: LeafletMapLike) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMapLike | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const init = usePersistFn(async () => {
    try {
      if (!mapContainer.current) {
        console.error("Map container not found");
        return;
      }

      if (map.current) {
        map.current.remove();
        map.current = null;
      }

      const L = await loadLeafletAssets();
      if (!L) {
        throw new Error("Leaflet 物件初始化失敗");
      }

      map.current = L.map(mapContainer.current, {
        zoomControl: true,
      }).setView([initialCenter.lat, initialCenter.lng], initialZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current);

      setMapError(null);
      const initializedMap = map.current;
      if (onMapReady && initializedMap) {
        onMapReady(initializedMap);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "地圖初始化失敗，請確認網路設定。";
      setMapError(message);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div className={cn("relative w-full h-[500px]", className)}>
      <div ref={mapContainer} className="w-full h-full" />
      {mapError && (
        <div className="absolute inset-0 bg-slate-950/80 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-lg font-bold mb-2">地圖載入失敗</p>
          <p className="text-sm leading-relaxed max-w-2xl">{mapError}</p>
          <p className="text-xs text-slate-300 mt-3">請檢查網路是否可連線至 OpenStreetMap 圖磚服務。</p>
        </div>
      )}
    </div>
  );
}
