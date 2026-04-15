import { MapView, type LatLngLiteral, type LeafletMapLike } from '@/components/Map';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';

type AgentSearchField = 'name' | 'taxId' | 'registrationType';

function matchesAgentKeyword(haystack: string, needle: string) {
  const n = needle.trim();
  if (!n) return true;
  return haystack.toLowerCase().includes(n.toLowerCase());
}

interface AssetItem {
  id: string;
  name: string;
  no: string;
  address: string;
  capacityKw: number;
  category: 'generation' | 'load' | 'storage';
  fallbackPosition: LatLngLiteral;
}

interface Agent {
  id: number;
  name: string;
  taxId: string;
  /** 與註冊申請總覽一致之註冊類型，供列表搜尋 */
  registrationType: string;
  genCap: number;
  loadCap: number;
  storageCap: number;
  genMeters: number;
  loadMeters: number;
  bessCount: number;
  genList: AssetItem[];
  loadList: AssetItem[];
  storageList: AssetItem[];
}

const agents: Agent[] = [
  {
    id: 1, name: '台電綠能聚合商', taxId: '87654321', registrationType: '註冊登記合格交易者', genCap: 2500, loadCap: 1500, storageCap: 1000, genMeters: 2, loadMeters: 1, bessCount: 1,
    genList: [
      { id: 'gen-1', name: '南科一期光電', no: '01-1234-56', address: '台南市新市區南科三路17號', capacityKw: 1400, category: 'generation', fallbackPosition: { lat: 23.098, lng: 120.293 } },
      { id: 'gen-2', name: '嘉義義竹光電', no: '01-5678-90', address: '嘉義縣義竹鄉義竹村88號', capacityKw: 1100, category: 'generation', fallbackPosition: { lat: 23.347, lng: 120.242 } },
    ],
    loadList: [
      { id: 'load-1', name: '新竹總部', no: '05-4321-98', address: '新竹市東區光復路二段101號', capacityKw: 1500, category: 'load', fallbackPosition: { lat: 24.785, lng: 120.997 } },
    ],
    storageList: [
      { id: 'storage-1', name: '台南大儲', no: 'S-9999-01', address: '台南市安定區港口里66號', capacityKw: 1000, category: 'storage', fallbackPosition: { lat: 23.119, lng: 120.237 } },
    ],
  },
  {
    id: 2, name: '永續綠能科技', taxId: '12345678', registrationType: '資訊變更', genCap: 4200, loadCap: 2000, storageCap: 2000, genMeters: 5, loadMeters: 1, bessCount: 2,
    genList: [
      { id: 'gen-3', name: '雲林光電群', no: '03-1111-22', address: '雲林縣麥寮鄉雲林路一段16號', capacityKw: 2400, category: 'generation', fallbackPosition: { lat: 23.789, lng: 120.257 } },
      { id: 'gen-4', name: '彰濱日照場', no: '03-2222-33', address: '彰化縣線西鄉彰濱工業區12號', capacityKw: 1800, category: 'generation', fallbackPosition: { lat: 24.127, lng: 120.448 } },
    ],
    loadList: [
      { id: 'load-2', name: '中壢工廠', no: '06-5555-66', address: '桃園市中壢區中華路一段12號', capacityKw: 2000, category: 'load', fallbackPosition: { lat: 24.965, lng: 121.223 } },
    ],
    storageList: [
      { id: 'storage-2', name: '桃園一號', no: 'S-8888-02', address: '桃園市觀音區大潭里18號', capacityKw: 1200, category: 'storage', fallbackPosition: { lat: 25.035, lng: 121.051 } },
      { id: 'storage-3', name: '桃園二號', no: 'S-8888-03', address: '桃園市新屋區文化路99號', capacityKw: 800, category: 'storage', fallbackPosition: { lat: 24.972, lng: 121.105 } },
    ],
  },
  {
    id: 3, name: '城市太陽能管理', taxId: '22334455', registrationType: '註冊登記合格交易者', genCap: 800, loadCap: 800, storageCap: 0, genMeters: 1, loadMeters: 1, bessCount: 0,
    genList: [
      { id: 'gen-5', name: '台北公有屋頂', no: '01-3333-44', address: '台北市信義區市府路1號', capacityKw: 800, category: 'generation', fallbackPosition: { lat: 25.037, lng: 121.563 } },
    ],
    loadList: [
      { id: 'load-3', name: '市府大樓', no: '05-6666-77', address: '台北市信義區松智路5號', capacityKw: 800, category: 'load', fallbackPosition: { lat: 25.034, lng: 121.566 } },
    ],
    storageList: [],
  },
  {
    id: 4, name: '全球碳中和顧問', taxId: '99887766', registrationType: '註冊登記合格交易者', genCap: 1500, loadCap: 1200, storageCap: 500, genMeters: 3, loadMeters: 1, bessCount: 1,
    genList: [
      { id: 'gen-6', name: '高雄一廠光電', no: '07-7777-88', address: '高雄市岡山區本工東一路8號', capacityKw: 1500, category: 'generation', fallbackPosition: { lat: 22.797, lng: 120.296 } },
    ],
    loadList: [
      { id: 'load-4', name: '數據中心', no: '08-9999-00', address: '高雄市前鎮區復興四路20號', capacityKw: 1200, category: 'load', fallbackPosition: { lat: 22.606, lng: 120.307 } },
    ],
    storageList: [
      { id: 'storage-4', name: '高雄微電網', no: 'S-7777-04', address: '高雄市路竹區環球路88號', capacityKw: 500, category: 'storage', fallbackPosition: { lat: 22.864, lng: 120.258 } },
    ],
  },
  {
    id: 5, name: '智慧電網儲能系統', taxId: '55443322', registrationType: '資訊變更', genCap: 3000, loadCap: 2500, storageCap: 3000, genMeters: 1, loadMeters: 1, bessCount: 5,
    genList: [
      { id: 'gen-7', name: '大容量離岸風', no: '09-1234-99', address: '苗栗縣通霄鎮海濱路89號', capacityKw: 3000, category: 'generation', fallbackPosition: { lat: 24.495, lng: 120.676 } },
    ],
    loadList: [
      { id: 'load-5', name: '竹科晶圓廠', no: '10-2222-11', address: '新竹市東區力行一路1號', capacityKw: 2500, category: 'load', fallbackPosition: { lat: 24.780, lng: 121.000 } },
    ],
    storageList: [
      { id: 'storage-5', name: '連鎖儲能 A', no: 'S-6666-05', address: '新竹縣寶山鄉雙園路168號', capacityKw: 1200, category: 'storage', fallbackPosition: { lat: 24.737, lng: 120.988 } },
      { id: 'storage-6', name: '連鎖儲能 B', no: 'S-6666-06', address: '新竹縣湖口鄉文化路66號', capacityKw: 1800, category: 'storage', fallbackPosition: { lat: 24.902, lng: 121.044 } },
    ],
  },
];

type MarkerRecord = {
  marker: any;
  asset: AssetItem;
};

const CATEGORY_MARKER_STYLE: Record<
  AssetItem['category'],
  { fill: string; stroke: string }
> = {
  generation: { fill: '#facc15', stroke: '#ca8a04' },
  load: { fill: '#fb7185', stroke: '#dc2626' },
  storage: { fill: '#60a5fa', stroke: '#2563eb' },
};

type GeocodeResult = {
  lat: string;
  lon: string;
};

async function geocodeAddress(address: string): Promise<LatLngLiteral | null> {
  const query = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as GeocodeResult[];
  const first = data[0];
  if (!first) return null;

  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
  };
}

function getAssetMeta(category: AssetItem['category']) {
  if (category === 'generation') {
    return { title: 'Account A 發電資產', icon: 'fas fa-sun', className: 'asset-theme-generation', shortLabel: 'A' };
  }
  if (category === 'load') {
    return { title: 'Account B 用電資產', icon: 'fas fa-building', className: 'asset-theme-load', shortLabel: 'B' };
  }
  return { title: 'Account C 儲能調節', icon: 'fas fa-battery-full', className: 'asset-theme-storage', shortLabel: 'C' };
}

function createMarkerContent(asset: AssetItem) {
  const meta = getAssetMeta(asset.category);
  const markerEl = document.createElement('div');
  markerEl.className = `resource-marker ${meta.className}`;
  markerEl.innerHTML = `
    <div class="resource-marker__pulse"></div>
    <div class="resource-marker__core">
      <i class="${meta.icon}"></i>
    </div>
    <div class="resource-marker__tooltip">
      <div class="resource-marker__title">${asset.name}</div>
      <div class="resource-marker__meta">${asset.capacityKw} kW</div>
    </div>
  `;
  return markerEl;
}

function AssetCard({
  asset,
  active,
  onHover,
  onLeave,
  onClick,
}: {
  asset: AssetItem;
  active: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const meta = getAssetMeta(asset.category);

  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
        active
          ? 'border-blue-400 bg-white shadow-lg scale-[1.01]'
          : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-800">{asset.name}</p>
          <p className="text-sm text-slate-500 mt-1">{asset.no}</p>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${meta.className}`}>
          <i className={meta.icon} />
          {meta.shortLabel}
        </span>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <p className="text-slate-600"><span className="font-bold text-slate-700">容量：</span>{asset.capacityKw} kW</p>
        <p className="text-slate-600"><span className="font-bold text-slate-700">地址：</span>{asset.address}</p>
        <p className="text-slate-600"><span className="font-bold text-slate-700">資產類型：</span>{meta.title}</p>
      </div>
    </button>
  );
}

export default function DashboardAgentAggregation() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [focusedAssetId, setFocusedAssetId] = useState<string | null>(null);
  const [resolvedPositions, setResolvedPositions] = useState<Record<string, LatLngLiteral>>({});
  const mapRef = useRef<LeafletMapLike | null>(null);
  /** 以 state 保存地圖實例，標記 effect 才能在地圖就緒後可靠重跑（僅 ref 不會觸發 render） */
  const [leafletMap, setLeafletMap] = useState<LeafletMapLike | null>(null);
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());
  const geocodeCacheRef = useRef<Record<string, LatLngLiteral>>({});
  const [agentSearchField, setAgentSearchField] = useState<AgentSearchField>('name');
  const [agentSearchKeyword, setAgentSearchKeyword] = useState('');

  const filteredAgents = useMemo(() => {
    const q = agentSearchKeyword.trim();
    if (!q) return agents;
    return agents.filter((agent) => {
      const value =
        agentSearchField === 'name'
          ? agent.name
          : agentSearchField === 'taxId'
            ? agent.taxId
            : agent.registrationType;
      return matchesAgentKeyword(value, q);
    });
  }, [agentSearchField, agentSearchKeyword]);

  const maxTotal = useMemo(() => {
    if (filteredAgents.length === 0) return 0;
    return Math.max(...filteredAgents.map((agent) => agent.genCap + agent.loadCap + agent.storageCap));
  }, [filteredAgents]);
  const selectedAgentAssets = useMemo(
    () => (selectedAgent ? [...selectedAgent.genList, ...selectedAgent.loadList, ...selectedAgent.storageList] : []),
    [selectedAgent]
  );
  const highlightedAssetId = hoveredAssetId ?? focusedAssetId;

  useEffect(() => {
    if (!selectedAgent) {
      setHoveredAssetId(null);
      setFocusedAssetId(null);
      setResolvedPositions({});
      markersRef.current.forEach(({ marker }) => {
        marker.remove();
      });
      markersRef.current.clear();
      mapRef.current = null;
      setLeafletMap(null);
    }
  }, [selectedAgent]);

  useEffect(() => {
    if (!selectedAgent) return;

    let cancelled = false;

    const resolveAll = async () => {
      const entries = await Promise.all(
        selectedAgentAssets.map(async (asset) => {
          if (geocodeCacheRef.current[asset.id]) {
            return [asset.id, geocodeCacheRef.current[asset.id]] as const;
          }

          const resolved = await geocodeAddress(asset.address);
          const location = resolved ?? asset.fallbackPosition;
          geocodeCacheRef.current[asset.id] = location;
          return [asset.id, location] as const;
        })
      );

      if (!cancelled) {
        setResolvedPositions(Object.fromEntries(entries));
      }
    };

    resolveAll();
    return () => {
      cancelled = true;
    };
  }, [selectedAgent, selectedAgentAssets]);

  useEffect(() => {
    const map = leafletMap;
    if (!map || !selectedAgent) return;

    markersRef.current.forEach(({ marker }) => {
      marker.remove();
    });
    markersRef.current.clear();

    const mapAny = map as any;
    mapAny.invalidateSize?.();

    const bounds = L.latLngBounds([]);

    selectedAgentAssets.forEach((asset) => {
      const position = resolvedPositions[asset.id] ?? asset.fallbackPosition;
      const style = CATEGORY_MARKER_STYLE[asset.category];
      const marker = L.circleMarker([position.lat, position.lng], {
        radius: 10,
        color: style.stroke,
        weight: 2,
        fillColor: style.fill,
        fillOpacity: 0.92,
      }).addTo(map);

      marker.bindPopup(
        `<div class="text-sm"><strong>${asset.name}</strong><br/>${asset.capacityKw} kW · ${getAssetMeta(asset.category).shortLabel}</div>`
      );

      marker.on('mouseover', () => setHoveredAssetId(asset.id));
      marker.on('mouseout', () => setHoveredAssetId((prev) => (prev === asset.id ? null : prev)));
      marker.on('click', () => setFocusedAssetId(asset.id));

      markersRef.current.set(asset.id, { marker, asset });
      bounds.extend([position.lat, position.lng]);
    });

    if (selectedAgentAssets.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [selectedAgent, selectedAgentAssets, resolvedPositions, leafletMap]);

  useEffect(() => {
    markersRef.current.forEach(({ asset, marker }) => {
      const isActive = highlightedAssetId === asset.id;
      const isFocused = focusedAssetId === asset.id;
      const style = CATEGORY_MARKER_STYLE[asset.category];
      const emphasis = isActive || isFocused;
      marker.setStyle({
        radius: emphasis ? 14 : 10,
        weight: emphasis ? 4 : 2,
        color: style.stroke,
        fillColor: style.fill,
        fillOpacity: 0.95,
      });

      if (isActive && mapRef.current) {
        mapRef.current.panTo(marker.getLatLng());
      }
    });
  }, [highlightedAssetId, focusedAssetId]);

  if (selectedAgent) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn">
        <button
          onClick={() => setSelectedAgent(null)}
          className="mb-6 text-slate-500 hover:text-blue-600 transition flex items-center font-bold"
        >
          <i className="fas fa-arrow-left mr-2" />
          返回總覽
        </button>

        <div className="border-b pb-6 mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-800">{selectedAgent.name}</h2>
            <p className="text-slate-400 mt-1">統一編號：{selectedAgent.taxId}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">總聚合容量</span>
            <p className="text-2xl font-black text-blue-600">
              {selectedAgent.genCap + selectedAgent.loadCap + selectedAgent.storageCap} kW
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-yellow-600 font-bold border-b-2 border-yellow-400 pb-2">
              <i className="fas fa-sun" />
              <span>Account A 發電資產</span>
            </div>
            {selectedAgent.genList.map((gen) => (
              <AssetCard
                key={gen.id}
                asset={gen}
                active={highlightedAssetId === gen.id}
                onHover={() => setHoveredAssetId(gen.id)}
                onLeave={() => setHoveredAssetId((prev) => (prev === gen.id ? null : prev))}
                onClick={() => setFocusedAssetId(gen.id)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-red-600 font-bold border-b-2 border-red-400 pb-2">
              <i className="fas fa-building" />
              <span>Account B 用電資產</span>
            </div>
            {selectedAgent.loadList.map((load) => (
              <AssetCard
                key={load.id}
                asset={load}
                active={highlightedAssetId === load.id}
                onHover={() => setHoveredAssetId(load.id)}
                onLeave={() => setHoveredAssetId((prev) => (prev === load.id ? null : prev))}
                onClick={() => setFocusedAssetId(load.id)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-600 font-bold border-b-2 border-blue-400 pb-2">
              <i className="fas fa-battery-full" />
              <span>Account C 儲能調節</span>
            </div>
            {selectedAgent.storageList.length > 0 ? (
              selectedAgent.storageList.map((storage) => (
                <AssetCard
                  key={storage.id}
                  asset={storage}
                  active={highlightedAssetId === storage.id}
                  onHover={() => setHoveredAssetId(storage.id)}
                  onLeave={() => setHoveredAssetId((prev) => (prev === storage.id ? null : prev))}
                  onClick={() => setFocusedAssetId(storage.id)}
                />
              ))
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-dashed text-slate-400">
                目前無儲能調節資產
              </div>
            )}
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-black text-slate-800">資源地理位置總覽</h3>
              <p className="text-slate-500 mt-1">地圖會同步顯示 A / B / C 三類資產位置，卡片與地圖標記可雙向互動。</p>
            </div>
            {highlightedAssetId && (
              <div className="text-right">
                <p className="text-sm text-slate-500">目前高亮資源</p>
                <p className="text-lg font-bold text-blue-700">
                  {selectedAgentAssets.find((asset) => asset.id === highlightedAssetId)?.name}
                </p>
              </div>
            )}
          </div>
          <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
            <MapView
              key={selectedAgent.id}
              className="h-[520px]"
              initialCenter={selectedAgentAssets[0]?.fallbackPosition ?? { lat: 23.7, lng: 120.9 }}
              initialZoom={8}
              onMapReady={(map) => {
                mapRef.current = map;
                setLeafletMap(map);
              }}
              onMapUnmount={() => {
                mapRef.current = null;
                setLeafletMap(null);
                markersRef.current.forEach(({ marker }) => marker.remove());
                markersRef.current.clear();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">代理人資源聚合管理</h2>
        <p className="text-base text-slate-500 mt-2">點選左側廠商可查看資產細項，右側為聚合規模對比。</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap mb-8">
        <div className="space-y-1.5 min-w-[200px]">
          <label className="text-sm font-bold text-slate-600">搜尋欄位</label>
          <Select
            value={agentSearchField}
            onValueChange={(v) => setAgentSearchField(v as AgentSearchField)}
          >
            <SelectTrigger className="w-full sm:w-[220px] border-slate-200 bg-white">
              <SelectValue placeholder="選擇欄位" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">申請名稱</SelectItem>
              <SelectItem value="taxId">統一編號</SelectItem>
              <SelectItem value="registrationType">註冊類型</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-sm font-bold text-slate-600">關鍵字</label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <Input
              value={agentSearchKeyword}
              onChange={(e) => setAgentSearchKeyword(e.target.value)}
              placeholder="輸入關鍵字篩選代理人…"
              className="pl-9 border-slate-200 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {filteredAgents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-slate-500">
              沒有符合條件的代理人，請調整關鍵字或搜尋欄位。
            </div>
          ) : (
            filteredAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all overflow-hidden flex"
            >
              <div className="w-2 bg-slate-800" />
              <div className="flex-1 p-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-3xl font-bold text-slate-800">{agent.name}</h3>
                  <span className="text-xl text-slate-500 font-mono">統編: {agent.taxId}</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  <span className="font-bold text-slate-600">註冊類型：</span>
                  {agent.registrationType}
                </p>

                <div className="grid grid-cols-3 gap-4 mb-2">
                  <div className="bg-yellow-50 p-3 rounded">
                    <p className="text-sm text-yellow-700 font-bold uppercase">發電聚合 (A)</p>
                    <p className="text-2xl font-black text-slate-700 leading-tight mt-1">{agent.genCap} kW</p>
                    <p className="text-base text-slate-600 mt-2">
                      <i className="fas fa-fingerprint mr-1" />
                      發電電號: <b className="text-slate-800">{agent.genMeters}</b>
                    </p>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <p className="text-sm text-red-700 font-bold uppercase">用電聚合 (B)</p>
                    <p className="text-2xl font-black text-slate-700 leading-tight mt-1">{agent.loadCap} kW</p>
                    <p className="text-base text-slate-600 mt-2">
                      <i className="fas fa-plug mr-1" />
                      用電電號: <b className="text-slate-800">{agent.loadMeters}</b>
                    </p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm text-blue-700 font-bold uppercase">儲能聚合 (C)</p>
                    <p className="text-2xl font-black text-slate-700 leading-tight mt-1">{agent.storageCap} kW</p>
                    <p className="text-base text-slate-600 mt-2">
                      <i className="fas fa-box mr-1" />
                      儲能站: <b className="text-slate-800">{agent.bessCount}</b>
                    </p>
                  </div>
                </div>
              </div>
              <div className="w-12 flex items-center justify-center bg-slate-50 text-slate-300">
                <i className="fas fa-chevron-right" />
              </div>
            </button>
            ))
          )}
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-20">
            <h3 className="text-md font-bold text-slate-700 mb-6 flex items-center">
              <i className="fas fa-chart-bar mr-2 text-blue-500" />
              各代理人聚合規模對比 (kW)
            </h3>
            <div className="space-y-4">
              {filteredAgents.map((agent) => {
                const total = agent.genCap + agent.loadCap + agent.storageCap;
                const barPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                return (
                  <div key={`${agent.id}-bar`}>
                    <div className="flex justify-between text-xs mb-1 text-slate-600">
                      <span className="truncate pr-2">{agent.name}</span>
                      <span className="font-bold">{total} kW</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-700"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 text-[11px] text-slate-400 leading-relaxed p-3 bg-slate-50 rounded">
              <i className="fas fa-info-circle mr-1" />
              此區依據各代理人註冊電號之聚合容量統計，供快速比對市場聚合規模。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
