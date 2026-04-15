import { useEffect, useRef, useState } from "react";
import L, { type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export type LeafletMapLike = LeafletMap;

interface MapViewProps {
  className?: string;
  initialCenter?: LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: LeafletMapLike) => void;
  /** 地圖實例卸載時呼叫（例如切換路由、key 變更），讓父層清掉 leafletMap state */
  onMapUnmount?: () => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  onMapUnmount,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMapLike | null>(null);
  const onMapUnmountRef = useRef(onMapUnmount);
  onMapUnmountRef.current = onMapUnmount;
  const [mapError, setMapError] = useState<string | null>(null);

  const init = usePersistFn(() => {
    try {
      if (!mapContainer.current) {
        console.error("Map container not found");
        return;
      }

      if (map.current) {
        map.current.remove();
        map.current = null;
      }

      const createdMap = L.map(mapContainer.current, {
        zoomControl: true,
      }).setView([initialCenter.lat, initialCenter.lng], initialZoom);
      map.current = createdMap;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(createdMap);

      createdMap.whenReady(() => {
        if (map.current !== createdMap) return;
        setMapError(null);
        if (onMapReady) {
          onMapReady(createdMap);
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "地圖初始化失敗，請確認網路設定。";
      setMapError(message);
    }
  });

  useEffect(() => {
    init();
  }, [init, initialCenter.lat, initialCenter.lng, initialZoom]);

  useEffect(() => {
    return () => {
      map.current?.remove();
      map.current = null;
      onMapUnmountRef.current?.();
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
