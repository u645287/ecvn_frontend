import { useRegistration } from '@/contexts/RegistrationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal, { type SweetAlertIcon } from 'sweetalert2';

const INTERVAL_COUNT = 96;
const GENERATION_MIN_KW = 0;
const GENERATION_MAX_KW = 50;
const LOAD_MIN_KW = 0;
const LOAD_MAX_KW = 50;
const BESS_MIN_KW = -50;
const BESS_MAX_KW = 50;
const MIDDAY_TRANSFER_REDUCTION_KW = 20;
const MIDDAY_BESS_EXTRA_CHARGE_KW = 20;
const EVENING_BESS_EXTRA_DISCHARGE_KW = 20;
const TRANSFER_GREEN = '#16a34a';

const base = import.meta.env.BASE_URL;
const declarationStatusLampSrcByVariant = {
  green: `${base}declaration-status-lamp.png`,
  orange: `${base}declaration-status-lamp-orange.png`,
  red: `${base}declaration-status-lamp-red.png`,
} as const;

type DeclarationLampVariant = keyof typeof declarationStatusLampSrcByVariant;

/** 光暈直接貼在燈體外緣，不再使用外層按鈕的 ring／白圓底 */
const lampEdgeGlowClass: Record<DeclarationLampVariant, string> = {
  green: 'shadow-[inset_0_2px_5px_rgba(15,23,42,0.14),0_0_12px_rgba(16,185,129,0.55),0_0_26px_rgba(16,185,129,0.28)]',
  orange:
    'shadow-[inset_0_2px_5px_rgba(15,23,42,0.14),0_0_12px_rgba(249,115,22,0.5),0_0_26px_rgba(249,115,22,0.26)]',
  red: 'shadow-[inset_0_2px_5px_rgba(15,23,42,0.14),0_0_12px_rgba(239,68,68,0.55),0_0_26px_rgba(239,68,68,0.28)]',
};

function DeclarationStatusLampIcon({ variant }: { variant: DeclarationLampVariant }) {
  const src = declarationStatusLampSrcByVariant[variant];
  return (
    <span
      className={`relative inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-b from-slate-100 to-slate-200 p-[2px] ${lampEdgeGlowClass[variant]}`}
    >
      <img
        src={src}
        alt=""
        width={48}
        height={48}
        decoding="async"
        draggable={false}
        className="h-[48px] w-[48px] rounded-full object-cover shadow-[inset_0_-2px_6px_rgba(0,0,0,0.12)]"
      />
    </span>
  );
}

type ResourceCategory = 'gen' | 'load' | 'bess';
type ResourceSeries = { id: string; data: number[] };
type AgentProfile = {
  id: string;
  name: string;
  taxId: string;
  contractCodes: string[];
};

function buildIntervalLabels(): string[] {
  return Array.from({ length: INTERVAL_COUNT }, (_, i) => {
    const h = Math.floor(i / 4)
      .toString()
      .padStart(2, '0');
    const m = ((i % 4) * 15).toString().padStart(2, '0');
    return `${h}:${m}`;
  });
}

const INTERVAL_LABELS = buildIntervalLabels();

function getHourByIndex(index: number): number {
  return index / 4;
}

function clampByRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getRangeByCategory(category: ResourceCategory): { min: number; max: number } {
  if (category === 'bess') return { min: BESS_MIN_KW, max: BESS_MAX_KW };
  if (category === 'load') return { min: LOAD_MIN_KW, max: LOAD_MAX_KW };
  return { min: GENERATION_MIN_KW, max: GENERATION_MAX_KW };
}

function isChargeWindow(index: number): boolean {
  const h = getHourByIndex(index);
  return h >= 10 && h < 14;
}

function isMiddayTransferReductionWindow(index: number): boolean {
  const h = getHourByIndex(index);
  return h >= 11 && h < 13;
}

function applyContractTransferStrategy(index: number, baseTransferKw: number): number {
  if (!isMiddayTransferReductionWindow(index)) return baseTransferKw;
  return Math.max(baseTransferKw - MIDDAY_TRANSFER_REDUCTION_KW, 0);
}

function getStrategicBessDeltaTotal(index: number): number {
  const h = getHourByIndex(index);
  if (h >= 11 && h < 13) return MIDDAY_BESS_EXTRA_CHARGE_KW;
  if (h >= 18 && h < 20) return -EVENING_BESS_EXTRA_DISCHARGE_KW;
  return 0;
}

function isDischargeWindow(index: number): boolean {
  const h = getHourByIndex(index);
  return h >= 16 && h < 20;
}

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** 日出／日落平滑包絡：夜間為 0，無 6:00、18:00 垂直斷點 */
function daylightEnvelope(hour: number): number {
  if (hour <= 5) return 0;
  if (hour < 7) return smoothstep01((hour - 5) / 2);
  if (hour <= 17) return 1;
  if (hour < 19) return smoothstep01((19 - hour) / 2);
  return 0;
}

/** 日間鐘形（僅乘上包絡後夜間必為 0） */
function pvBell(hour: number): number {
  const x = (hour - 12.25) / 5.8;
  return Math.exp(-x * x * 2);
}

function pvCurve(hour: number): number {
  return daylightEnvelope(hour) * pvBell(hour);
}

function loadCurve(hour: number): number {
  const morning = Math.exp(-(((hour - 9) / 2.2) ** 2));
  const evening = Math.exp(-(((hour - 19) / 2.8) ** 2));
  const base = 0.45 + 0.35 * morning + 0.65 * evening;
  return Math.min(1.2, base);
}

function createInitialStore(): Record<ResourceCategory, ResourceSeries[]> {
  const genCaps = [8, 9, 10, 11, 12];
  const loadCaps = [8, 9, 10, 11, 12];
  const chargeCaps = [9, 7, 6];
  const dischargeCaps = [10, 8, 7];

  return {
    gen: genCaps.map((cap, i) => ({
      id: `G${i + 1}`,
      data: INTERVAL_LABELS.map((_, idx) => {
        const hour = getHourByIndex(idx);
        const pv = pvCurve(hour);
        // 僅乘性微調場際差異；夜間 pv=0 時不會出現固定底噪
        const diversity = 0.92 + 0.08 * Math.sin((hour * Math.PI) / 13 + i * 0.55);
        const kw = cap * pv * diversity;
        return clampByRange(kw, 0, GENERATION_MAX_KW);
      }),
    })),
    load: loadCaps.map((cap, i) => ({
      id: `L${i + 1}`,
      data: INTERVAL_LABELS.map((_, idx) => {
        const hour = getHourByIndex(idx);
        const curve = loadCurve(hour);
        const withNoise = cap * curve + i * 0.2;
        return clampByRange(withNoise, LOAD_MIN_KW, LOAD_MAX_KW);
      }),
    })),
    bess: [1, 2, 3].map((i) => ({
      id: `B${i}`,
      data: INTERVAL_LABELS.map((_, idx) => {
        if (isChargeWindow(idx)) {
          const phase = (idx % 16) / 15;
          const val = chargeCaps[i - 1] * (0.75 + 0.25 * phase);
          return clampByRange(val, BESS_MIN_KW, BESS_MAX_KW);
        }
        if (isDischargeWindow(idx)) {
          const phase = (idx % 16) / 15;
          const val = -dischargeCaps[i - 1] * (0.8 + 0.2 * (1 - phase));
          return clampByRange(val, BESS_MIN_KW, BESS_MAX_KW);
        }
        return 0;
      }),
    })),
  };
}

function sumSeriesAt(
  store: Record<ResourceCategory, ResourceSeries[]>,
  cat: ResourceCategory,
  i: number
) {
  return store[cat].reduce((acc, s) => acc + s.data[i], 0);
}

const GEN_LINE_COLORS = ['#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#10b981']; // 藍→綠
const LOAD_LINE_COLORS = ['#dc2626', '#ef4444', '#f97316', '#fb923c', '#f59e0b']; // 紅→橘
const BESS_BAR_COLORS = ['#2563eb', '#4f46e5', '#7c3aed']; // 藍→紫

const SUMMARY_CARD_STATS = [
  {
    title: '發電總量 (G)',
    value: '3298.2',
    unit: 'kWh',
    icon: 'fas fa-solar-panel',
    accent: 'border-t-sky-500',
    iconColor: 'text-sky-600',
  },
  {
    title: '用電總量 (L)',
    value: '2998.3',
    unit: 'kWh',
    icon: 'fas fa-plug-circle-bolt',
    accent: 'border-t-orange-500',
    iconColor: 'text-orange-600',
  },
  {
    title: '儲能狀態 (BESS)',
    value: '-10.3',
    unit: 'kWh',
    icon: 'fas fa-battery-three-quarters',
    accent: 'border-t-violet-600',
    iconColor: 'text-violet-600',
    /** 滑鼠移到此卡可顯示充／放電允許時段 */
    showStorageScheduleTooltip: true,
  },
] as const;

const STORAGE_SCHEDULE_TOOLTIP_TEXT =
  '儲能只可以在10:00-14:00充電、放電只可以在16:00-20:00之間';

function eachDayInclusive(from: Date, to: Date): Date[] {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  if (a.getTime() > b.getTime()) return eachDayInclusive(to, from);
  const out: Date[] = [];
  const cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** 與封面同圓角裁切；翻開後以內陰影模擬紙邊厚度，不向外溢出、不留外框縫 */
function PassbookWithPageEdge({
  children,
  showEdge = true,
}: {
  children: React.ReactNode;
  showEdge?: boolean;
}) {
  return (
    <div className={cn('relative h-full min-h-0', showEdge && 'overflow-hidden rounded-2xl')}>{children}</div>
  );
}

const AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'agent-a',
    name: '台電綠能聚合商',
    taxId: '87654321',
    contractCodes: ['CON-AGT-2026-001'],
  },
  {
    id: 'agent-b',
    name: '中區綜合能源代理商',
    taxId: '28469173',
    contractCodes: ['CON-AGT-2026-018', 'CON-AGT-2026-019', 'CON-AGT-2026-021'],
  },
  {
    id: 'agent-c',
    name: '南部智慧電力聚合商',
    taxId: '50931764',
    contractCodes: ['CON-AGT-2026-026', 'CON-AGT-2026-027'],
  },
];

function popup(icon: SweetAlertIcon, title: string, text: string) {
  void Swal.fire({
    icon,
    title,
    text,
    timer: 1800,
    timerProgressBar: true,
    showConfirmButton: false,
    position: 'center',
  });
}

export default function DeclarationPlanPage() {
  const { declarationPlanSection, declarationPlanNavSeq, currentView } = useRegistration();
  const storagePassbookCoverUrl = new URL('storage-passbook-cover.png', document.baseURI).toString();

  const [store, setStore] = useState(createInitialStore);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('資料上傳');
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyCategory, setModifyCategory] = useState<ResourceCategory>('gen');
  const [modifyTargetIndex, setModifyTargetIndex] = useState(0);
  const [refCode, setRefCode] = useState('REF-EDIT-99');
  const [editBuffer, setEditBuffer] = useState<number[]>([]);
  const [socInitialValues, setSocInitialValues] = useState<number[]>([45, 53, 61]);
  const [socModalOpen, setSocModalOpen] = useState(false);
  const [storageLedgerOpen, setStorageLedgerOpen] = useState(false);
  const [storageLedgerFlipped, setStorageLedgerFlipped] = useState(false);
  const [storageLedgerHistoryOpen, setStorageLedgerHistoryOpen] = useState(false);
  const [historyQueryStart, setHistoryQueryStart] = useState('');
  const [historyQueryEnd, setHistoryQueryEnd] = useState('');
  const [socEditBuffer, setSocEditBuffer] = useState<number[]>([45, 53, 61]);
  const [resourceExpanded, setResourceExpanded] = useState(false);
  const [agentDetailExpanded, setAgentDetailExpanded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('agent-b');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const csvInputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = useMemo(
    () => AGENT_PROFILES.find((agent) => agent.id === selectedAgentId) ?? AGENT_PROFILES[1],
    [selectedAgentId]
  );

  useEffect(() => {
    if (currentView !== 'declaration-plan') return;
    const el = document.getElementById(`declaration-section-${declarationPlanSection}`);
    requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [currentView, declarationPlanSection, declarationPlanNavSeq]);

  const summaryRows = useMemo(() => {
    return INTERVAL_LABELS.map((time, i) => {
      const genVal = sumSeriesAt(store, 'gen', i);
      const loadVal = sumSeriesAt(store, 'load', i);
      const contractQty = applyContractTransferStrategy(i, Math.min(genVal, loadVal));
      const strategicBess = sumSeriesAt(store, 'bess', i) + getStrategicBessDeltaTotal(i);
      return {
        time,
        gen: genVal,
        load: loadVal,
        bess: Number(strategicBess.toFixed(3)),
        contractQty: Number(contractQty.toFixed(3)),
      };
    });
  }, [store]);

  const genRows = useMemo(() => {
    return INTERVAL_LABELS.map((time, i) => {
      const row: Record<string, string | number> = { time };
      store.gen.forEach((g, j) => {
        row[`g${j}`] = g.data[i];
      });
      return row;
    });
  }, [store]);

  const loadRows = useMemo(() => {
    return INTERVAL_LABELS.map((time, i) => {
      const row: Record<string, string | number> = { time };
      store.load.forEach((g, j) => {
        row[`l${j}`] = g.data[i];
      });
      return row;
    });
  }, [store]);

  const bessRows = useMemo(() => {
    const bessCount = Math.max(store.bess.length, 1);
    return INTERVAL_LABELS.map((time, i) => {
      const row: Record<string, string | number> = { time };
      const deltaPerSeries = getStrategicBessDeltaTotal(i) / bessCount;
      store.bess.forEach((g, j) => {
        row[`b${j}`] = Number((g.data[i] + deltaPerSeries).toFixed(3));
      });
      return row;
    });
  }, [store]);

  /** 3.4：轉供量跟隨再生能源合計，每 15 分鐘不超過負載合計 */
  const contractTransferRows = useMemo(() => {
    return INTERVAL_LABELS.map((time, i) => {
      const genSum = sumSeriesAt(store, 'gen', i);
      const loadSum = sumSeriesAt(store, 'load', i);
      const transfer = applyContractTransferStrategy(i, Math.min(genSum, loadSum));
      return {
        time,
        transfer: Number(transfer.toFixed(3)),
        genSum: Number(genSum.toFixed(3)),
        loadSum: Number(loadSum.toFixed(3)),
      };
    });
  }, [store]);
  const cumulativeStorageEffectiveKwh = useMemo(() => {
    const baseDate = new Date(`${selectedDate}T00:00:00`);
    const dayStartMs = Number.isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const expiryMs = dayStartMs - sevenDaysMs;
    type EnergyBucket = { ts: number; kwh: number };
    const buckets: EnergyBucket[] = [];

    summaryRows.forEach((row, idx) => {
      const intervalTs = dayStartMs + idx * 15 * 60 * 1000;
      const intervalKwh = row.bess / 4;
      if (intervalKwh > 0) {
        buckets.push({ ts: intervalTs, kwh: intervalKwh });
        return;
      }
      if (intervalKwh < 0) {
        let remainingDischarge = Math.abs(intervalKwh);
        while (remainingDischarge > 0 && buckets.length > 0) {
          const oldest = buckets[0];
          if (!oldest) break;
          const consumed = Math.min(oldest.kwh, remainingDischarge);
          oldest.kwh -= consumed;
          remainingDischarge -= consumed;
          if (oldest.kwh <= 0.000001) buckets.shift();
        }
      }
    });

    return buckets
      .filter((bucket) => bucket.ts >= expiryMs)
      .reduce((acc, bucket) => acc + bucket.kwh, 0);
  }, [summaryRows, selectedDate]);

  const storageLedgerRows = useMemo(() => {
    const baseDate = new Date(`${selectedDate}T00:00:00`);
    const dayStart = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const chargeKwhToday = summaryRows.reduce((acc, row) => acc + Math.max(row.bess / 4, 0), 0);
    const dischargeKwhToday = summaryRows.reduce((acc, row) => acc + Math.max(-(row.bess / 4), 0), 0);
    const todayNetKwh = chargeKwhToday - dischargeKwhToday;

    const rows = Array.from({ length: 7 }, (_, idx) => {
      const dayOffset = 6 - idx;
      const date = new Date(dayStart);
      date.setDate(dayStart.getDate() - dayOffset);
      const dayFactor = 0.72 + idx * 0.06;
      const dayNetKwh = Number((todayNetKwh * dayFactor + Math.sin(idx * 1.7) * 3.2).toFixed(3));
      return {
        dateLabel: date.toISOString().slice(0, 10),
        netMwh: Number((dayNetKwh / 1000).toFixed(3)),
        status: dayOffset === 6 ? '今日過期 EXPIRED' : `剩餘 ${6 - dayOffset} 天`,
        expired: dayOffset === 6,
      };
    });
    return rows;
  }, [selectedDate, summaryRows]);

  const totalExpiredMwh = useMemo(() => {
    return storageLedgerRows
      .filter((row) => row.expired && row.netMwh > 0)
      .reduce((acc, row) => acc + row.netMwh, 0);
  }, [storageLedgerRows]);

  const storageHistoryRows = useMemo(() => {
    if (!historyQueryStart || !historyQueryEnd) return [];
    let from = new Date(`${historyQueryStart}T00:00:00`);
    let to = new Date(`${historyQueryEnd}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
    if (from.getTime() > to.getTime()) {
      const swap = from;
      from = to;
      to = swap;
    }
    return eachDayInclusive(from, to).map((d, idx) => {
      const t = d.getTime();
      const netMwh = Number(
        ((Math.sin(t / 8e7) * 0.35 + 0.85 + (idx % 7) * 0.03) * 0.42).toFixed(3)
      );
      const hasExpired = (t / 86400000 + idx) % 13 === 0 && netMwh > 0.06;
      const expiredMwh = hasExpired ? Number((netMwh * 0.2 + 0.015).toFixed(3)) : 0;
      return {
        dateLabel: d.toISOString().slice(0, 10),
        netMwh,
        expiredMwh,
      };
    });
  }, [historyQueryStart, historyQueryEnd]);

  const historyExpiredRangeMwh = useMemo(
    () => storageHistoryRows.reduce((acc, row) => acc + row.expiredMwh, 0),
    [storageHistoryRows]
  );

  const bessSocRows = useMemo(() => {
    const bessCount = Math.max(store.bess.length, 1);
    const seriesSoc = store.bess.map((series, seriesIdx) => {
      const initialSoc = clampByRange(socInitialValues[seriesIdx] ?? 50, 0, 100);
      const socData: number[] = [];
      let soc = initialSoc;
      series.data.forEach((kw, idx) => {
        const adjustedKw = kw + getStrategicBessDeltaTotal(idx) / bessCount;
        // 15 分鐘轉換為 SOC 變化比例（示意邏輯）
        const delta = (adjustedKw / 12) * 2.2;
        soc = clampByRange(soc + delta, 0, 100);
        socData.push(soc);
      });
      return { id: series.id, socData };
    });

    return INTERVAL_LABELS.map((time, i) => {
      const row: Record<string, string | number> = { time };
      seriesSoc.forEach((series, idx) => {
        row[`soc${idx}`] = series.socData[i];
      });
      return row;
    });
  }, [store.bess, socInitialValues]);

  const baseChartOption = useMemo(
    () => ({
      animation: false,
      grid: { top: 28, right: 16, bottom: 72, left: 52, containLabel: true },
      legend: {
        bottom: 14,
        textStyle: { color: '#0f172a', fontSize: 11 },
      },
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'line' as const } },
      xAxis: {
        type: 'category' as const,
        axisLabel: { color: '#0f172a', fontSize: 10, interval: 7, margin: 14, hideOverlap: true },
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#0f172a', fontSize: 10 },
        axisLine: { show: true, lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#94a3b8', type: 'dashed' } },
        nameTextStyle: { color: '#0f172a' },
      },
    }),
    []
  );

  const summaryOption = useMemo<EChartsOption>(
    () => ({
      ...baseChartOption,
      xAxis: { ...(baseChartOption.xAxis as object), data: summaryRows.map((d) => d.time) },
      yAxis: { ...(baseChartOption.yAxis as object), name: 'kW' },
      tooltip: {
        ...baseChartOption.tooltip,
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const first = list[0] as { axisValueLabel?: string } | undefined;
          const rows = list
            .map((p) => {
              const item = p as { marker?: string; seriesName?: string; value?: number | [string, number] };
              const v = Array.isArray(item.value) ? Number(item.value[1] ?? 0) : Number(item.value ?? 0);
              return `${item.marker ?? ''}${item.seriesName ?? ''}：${v.toFixed(3)} kW`;
            })
            .join('<br/>');
          return `${first?.axisValueLabel ?? ''}<br/>${rows}`;
        },
      },
      series: [
        { name: '發電 (kW)', type: 'line', smooth: true, showSymbol: false, symbol: 'circle', symbolSize: 6, color: '#0ea5e9', lineStyle: { width: 2.2, color: '#0ea5e9' }, itemStyle: { color: '#0ea5e9' }, data: summaryRows.map((d) => d.gen) },
        { name: '用電 (kW)', type: 'line', smooth: true, showSymbol: false, symbol: 'circle', symbolSize: 6, color: '#ef4444', lineStyle: { width: 2.2, color: '#ef4444' }, itemStyle: { color: '#ef4444' }, data: summaryRows.map((d) => d.load) },
        { name: '合約數量', type: 'line', smooth: true, showSymbol: false, symbol: 'circle', symbolSize: 6, color: '#16a34a', lineStyle: { width: 2.2, color: '#16a34a', type: 'dashed' }, itemStyle: { color: '#16a34a' }, areaStyle: { color: 'rgba(22,163,74,0.65)' }, data: summaryRows.map((d) => d.contractQty) },
        { name: '儲能 (kW)', type: 'bar', color: '#4f46e5', itemStyle: { color: '#4f46e5' }, barWidth: 6, data: summaryRows.map((d) => d.bess) },
      ],
    }),
    [baseChartOption, summaryRows]
  );

  const genOption = useMemo<EChartsOption>(
    () => ({
      ...baseChartOption,
      xAxis: { ...(baseChartOption.xAxis as object), data: genRows.map((d) => String(d.time)) },
      yAxis: { ...(baseChartOption.yAxis as object), name: 'kW' },
      series: store.gen.map((obj, i) => ({
        name: `場號 ${obj.id} (kW)`,
        type: 'line',
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 6,
        color: GEN_LINE_COLORS[i % GEN_LINE_COLORS.length],
        lineStyle: { width: 2.2, color: GEN_LINE_COLORS[i % GEN_LINE_COLORS.length] },
        itemStyle: { color: GEN_LINE_COLORS[i % GEN_LINE_COLORS.length] },
        data: genRows.map((r) => Number(r[`g${i}`] ?? 0)),
      })),
    }),
    [baseChartOption, genRows, store.gen]
  );

  const loadOption = useMemo<EChartsOption>(
    () => ({
      ...baseChartOption,
      xAxis: { ...(baseChartOption.xAxis as object), data: loadRows.map((d) => String(d.time)) },
      yAxis: { ...(baseChartOption.yAxis as object), name: 'kW' },
      series: store.load.map((obj, i) => ({
        name: `用戶 ${obj.id} (kW)`,
        type: 'line',
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 6,
        color: LOAD_LINE_COLORS[i % LOAD_LINE_COLORS.length],
        lineStyle: { width: 2.2, color: LOAD_LINE_COLORS[i % LOAD_LINE_COLORS.length] },
        itemStyle: { color: LOAD_LINE_COLORS[i % LOAD_LINE_COLORS.length] },
        data: loadRows.map((r) => Number(r[`l${i}`] ?? 0)),
      })),
    }),
    [baseChartOption, loadRows, store.load]
  );

  const contractOption = useMemo<EChartsOption>(
    () => ({
      ...baseChartOption,
      xAxis: { ...(baseChartOption.xAxis as object), data: contractTransferRows.map((d) => d.time) },
      yAxis: { ...(baseChartOption.yAxis as object), name: 'kW' },
      series: [
        { name: '再生能源合計（參考）', type: 'line', smooth: true, showSymbol: false, symbol: 'circle', symbolSize: 6, color: '#2563eb', lineStyle: { width: 2.2, color: '#2563eb' }, itemStyle: { color: '#2563eb' }, data: contractTransferRows.map((d) => d.genSum) },
        { name: '負載合計（上限）', type: 'line', smooth: true, showSymbol: false, symbol: 'circle', symbolSize: 6, color: '#dc2626', lineStyle: { width: 2.2, color: '#dc2626' }, itemStyle: { color: '#dc2626' }, data: contractTransferRows.map((d) => d.loadSum) },
        {
          name: '合約轉供量',
          type: 'line',
          smooth: false,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          color: TRANSFER_GREEN,
          lineStyle: { width: 2.6, color: TRANSFER_GREEN, type: 'dashed' },
          itemStyle: { color: TRANSFER_GREEN },
          areaStyle: { color: 'rgba(22,163,74,0.65)' },
          data: contractTransferRows.map((d) => d.transfer),
        },
      ],
    }),
    [baseChartOption, contractTransferRows]
  );

  const bessOption = useMemo<EChartsOption>(
    () => ({
      ...baseChartOption,
      xAxis: { ...(baseChartOption.xAxis as object), data: bessRows.map((d) => String(d.time)) },
      yAxis: { ...(baseChartOption.yAxis as object), name: 'kW' },
      series: store.bess.map((obj, i) => ({
        name: `儲能站 ${obj.id} (kW)`,
        type: 'bar',
        stack: 'bess',
        color: BESS_BAR_COLORS[i % BESS_BAR_COLORS.length],
        itemStyle: { color: BESS_BAR_COLORS[i % BESS_BAR_COLORS.length] },
        data: bessRows.map((r) => Number(r[`b${i}`] ?? 0)),
      })),
    }),
    [baseChartOption, bessRows, store.bess]
  );

  const socOption = useMemo<EChartsOption>(
    () => ({
      ...baseChartOption,
      xAxis: { ...(baseChartOption.xAxis as object), data: bessSocRows.map((d) => String(d.time)) },
      yAxis: { ...(baseChartOption.yAxis as object), name: 'SOC (%)', min: 0, max: 100 },
      tooltip: {
        ...baseChartOption.tooltip,
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const first = list[0] as { axisValueLabel?: string } | undefined;
          const rows = list
            .map((p) => {
              const item = p as { marker?: string; seriesName?: string; value?: number | [string, number] };
              const v = Array.isArray(item.value) ? Number(item.value[1] ?? 0) : Number(item.value ?? 0);
              return `${item.marker ?? ''}${item.seriesName ?? ''}：${v.toFixed(1)} %`;
            })
            .join('<br/>');
          return `${first?.axisValueLabel ?? ''}<br/>${rows}`;
        },
      },
      series: store.bess.map((obj, i) => ({
        name: `SOC ${obj.id} (%)`,
        type: 'line',
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 6,
        color: BESS_BAR_COLORS[i % BESS_BAR_COLORS.length],
        lineStyle: { width: 2.2, color: BESS_BAR_COLORS[i % BESS_BAR_COLORS.length] },
        itemStyle: { color: BESS_BAR_COLORS[i % BESS_BAR_COLORS.length] },
        data: bessSocRows.map((r) => Number(r[`soc${i}`] ?? 0)),
      })),
    }),
    [baseChartOption, bessSocRows, store.bess]
  );

  const genResourceTotals = useMemo(
    () =>
      store.gen.map((series) => ({
        id: series.id,
        total: series.data.reduce((acc, val) => acc + val, 0) / 4,
      })),
    [store.gen]
  );

  const loadResourceTotals = useMemo(
    () =>
      store.load.map((series) => ({
        id: series.id,
        total: series.data.reduce((acc, val) => acc + val, 0) / 4,
      })),
    [store.load]
  );

  const bessResourceTotals = useMemo(
    () =>
      store.bess.map((series) => {
        const bessCount = Math.max(store.bess.length, 1);
        const charge =
          series.data.reduce((acc, val, idx) => {
            const adjusted = val + getStrategicBessDeltaTotal(idx) / bessCount;
            return acc + (adjusted > 0 ? adjusted : 0);
          }, 0) / 4;
        const discharge =
          series.data.reduce((acc, val, idx) => {
            const adjusted = val + getStrategicBessDeltaTotal(idx) / bessCount;
            return acc + (adjusted < 0 ? Math.abs(adjusted) : 0);
          }, 0) / 4;
        return { id: series.id, charge, discharge };
      }),
    [store.bess]
  );

  const openUpload = (title: string) => {
    setUploadTitle(title);
    setUploadOpen(true);
  };

  const openSocModify = () => {
    setSocEditBuffer([...socInitialValues]);
    setSocModalOpen(true);
  };

  const saveSocInitial = () => {
    const next = socEditBuffer.map((v, idx) => {
      const clamped = clampByRange(v, 0, 100);
      if (!Number.isFinite(v) || v !== clamped) {
        popup('warning', '警告', `BESS${idx + 1} 初始SOC超出範圍，已修正為 ${clamped.toFixed(1)}%`);
      }
      return clamped;
    });
    setSocInitialValues(next);
    popup('success', '成功', '已更新初始 SOC，後續時段由系統自動計算');
    setSocModalOpen(false);
  };

  const openModify = (preset?: ResourceCategory) => {
    const cat = preset ?? 'gen';
    setModifyCategory(cat);
    setModifyTargetIndex(0);
    setModifyOpen(true);
  };

  useEffect(() => {
    if (!modifyOpen) return;
    const series = store[modifyCategory][modifyTargetIndex];
    if (series) setEditBuffer([...series.data]);
  }, [modifyOpen, modifyCategory, modifyTargetIndex, store]);

  const validateAndClampValue = useCallback(
    (raw: number, interval: string, category: ResourceCategory, index: number): number => {
      const range = getRangeByCategory(category);
      let clamped = clampByRange(raw, range.min, range.max);

      if (category === 'bess') {
        if (clamped > 0 && !isChargeWindow(index)) {
          popup('warning', '警告', `${interval} 非充電時段，已改為 0.000 kW`);
          clamped = 0;
        } else if (clamped < 0 && !isDischargeWindow(index)) {
          popup('warning', '警告', `${interval} 非放電時段，已改為 0.000 kW`);
          clamped = 0;
        }
      }

      if (!Number.isFinite(raw) || raw !== clamped) {
        popup(
          'warning',
          '警告',
          `${interval} 超出範圍，已自動修正為 ${clamped.toFixed(3)} kW（允許 ${range.min}~${range.max}）`
        );
      }
      return clamped;
    },
    []
  );

  const updateEditValue = useCallback((index: number, value: number) => {
    setEditBuffer((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const validateIndexOnBlur = useCallback(
    (index: number) => {
      setEditBuffer((prev) => {
        const next = [...prev];
        next[index] = validateAndClampValue(next[index], INTERVAL_LABELS[index], modifyCategory, index);
        return next;
      });
    },
    [validateAndClampValue, modifyCategory]
  );

  const saveModify = () => {
    if (!refCode.trim()) {
      popup('error', '錯誤', '請輸入參考碼後再提交');
      return;
    }
    const newData = editBuffer.map((v, i) =>
      validateAndClampValue(v, INTERVAL_LABELS[i], modifyCategory, i)
    );
    setStore((prev) => ({
      ...prev,
      [modifyCategory]: prev[modifyCategory].map((s, i) =>
        i === modifyTargetIndex ? { ...s, data: newData } : s
      ),
    }));
    popup('success', '成功', `資源 ${store[modifyCategory][modifyTargetIndex]?.id} 已更新`);
    setModifyOpen(false);
  };

  const chartWrap = 'h-[360px] w-full min-h-[320px]';
  const sectionTitleClass = 'border-b border-slate-300 pb-2 text-lg font-bold text-slate-900';
  const modifyRange = getRangeByCategory(modifyCategory);

  const firstInterval = summaryRows[0] ?? { gen: 0, load: 0, bess: 0, contractQty: 0 };
  const surplusKw = Math.max(firstInterval.gen - firstInterval.load, 0);
  const storageChargingKw = Math.max(firstInterval.bess, 0);
  const unstoredSurplusKw = Math.max(surplusKw - storageChargingKw, 0);
  const latestSocValues = store.bess.map((_, idx) => {
    const row = bessSocRows[bessSocRows.length - 1];
    return Number((row?.[`soc${idx}`] as number | undefined) ?? 0);
  });
  const socHasRed = latestSocValues.some((soc) => soc <= 10 || soc >= 90);
  const socHasOrange = latestSocValues.some((soc) => (soc > 10 && soc <= 20) || (soc >= 80 && soc < 90));
  const lampConfig =
    unstoredSurplusKw > 3
      ? {
          label: '危險',
          lampVariant: 'red' as const,
        }
      : unstoredSurplusKw > 1
        ? {
            label: '注意',
            lampVariant: 'orange' as const,
          }
        : {
            label: '正常',
            lampVariant: 'green' as const,
          };
  const socLampConfig = socHasRed
    ? {
        label: '異常',
        lampVariant: 'red' as const,
      }
    : socHasOrange
      ? {
          label: '警告',
          lampVariant: 'orange' as const,
        }
      : {
          label: '正常',
          lampVariant: 'green' as const,
        };

  return (
    <div className="space-y-6 pb-10">
      <section id="declaration-section-total" className="scroll-mt-28 space-y-6">
        <h2 className={sectionTitleClass}>3.1 總量</h2>
        <div className="rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-sm md:px-4 md:py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 md:gap-x-4 md:gap-y-2">
            <h3 className="shrink-0 text-xs font-black leading-none text-blue-950 sm:text-sm md:text-base">
              每日申報計畫
            </h3>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3 md:gap-x-4">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase leading-none text-slate-500 sm:text-[11px]">
                  代理人名稱
                </span>
                <Select value={selectedAgent.id} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="h-8 w-[min(100%,12rem)] border-slate-300 bg-white px-2 text-xs text-slate-900 sm:h-9 sm:w-[min(100%,14rem)] sm:text-sm md:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_PROFILES.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => setAgentDetailExpanded((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-800 transition hover:border-slate-300 hover:bg-white hover:text-blue-700 sm:text-xs"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white text-[10px] leading-none">
                  {agentDetailExpanded ? '−' : '+'}
                </span>
                詳細資訊
              </button>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase leading-none text-slate-500 sm:text-[11px]">
                  申報日期
                </span>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-8 w-[9.25rem] border-slate-300 bg-white px-2 py-0 text-xs text-slate-900 sm:h-9 sm:w-40 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {agentDetailExpanded && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-sm">
                <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
                  <dl className="space-y-6 p-6">
                    <div>
                      <dt className="text-sm font-bold text-slate-500">代理人名稱</dt>
                      <dd className="mt-2 text-sm font-bold tracking-normal text-slate-900">{selectedAgent.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-bold text-slate-500">統編</dt>
                      <dd className="mt-2 text-sm font-bold tracking-normal text-slate-900">{selectedAgent.taxId}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-6 p-6">
                    <div>
                      <dt className="text-sm font-bold text-slate-500">合約代號</dt>
                      <dd className="mt-2 space-y-2 text-sm font-bold tracking-normal text-slate-900">
                        {selectedAgent.contractCodes.map((code) => (
                          <p key={code}>{code}</p>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-bold text-slate-500">合約數量</dt>
                      <dd className="mt-2 text-sm font-bold tracking-normal text-slate-900">
                        {selectedAgent.contractCodes.length}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            {SUMMARY_CARD_STATS.map((card) => {
              const cardHeader = (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {card.value} <span className="text-sm font-medium text-slate-700">{card.unit}</span>
                    </p>
                  </div>
                  <div className="shrink-0">
                    <i
                      className={`${card.icon} ${card.iconColor} text-6xl opacity-90 drop-shadow-[0_0_6px_rgba(59,130,246,0.45)]`}
                    />
                  </div>
                </div>
              );
              return (
              <div
                key={card.title}
                className={`rounded-2xl border border-slate-300 bg-white p-6 shadow-sm border-t-4 ${card.accent}`}
              >
                {'showStorageScheduleTooltip' in card && card.showStorageScheduleTooltip ? (
                  <UiTooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        aria-label={`${card.title}：${STORAGE_SCHEDULE_TOOLTIP_TEXT}`}
                        className="cursor-help rounded-lg outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        {cardHeader}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="max-w-xs border border-slate-300 bg-slate-100 text-slate-900 shadow-xl text-balance"
                    >
                      <p className="font-semibold">{STORAGE_SCHEDULE_TOOLTIP_TEXT}</p>
                    </TooltipContent>
                  </UiTooltip>
                ) : (
                  cardHeader
                )}
                <button
                  type="button"
                  onClick={() => setResourceExpanded((prev) => !prev)}
                  className="mx-auto mt-4 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                  aria-label={resourceExpanded ? '收合資源明細' : '展開資源明細'}
                >
                  <i className={`fas ${resourceExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                </button>
              </div>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-row flex-wrap items-start justify-center gap-5 border-t border-slate-200 pt-4 sm:gap-6 lg:flex-nowrap lg:justify-start lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <UiTooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="flex min-w-[88px] flex-col items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900 sm:text-base">餘電燈號</p>
                  <button
                    type="button"
                    aria-label={`餘電燈號：${lampConfig.label}，未儲存餘電 ${unstoredSurplusKw.toFixed(3)} kW`}
                    className="flex h-20 w-20 shrink-0 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none ring-0 transition hover:scale-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    <DeclarationStatusLampIcon variant={lampConfig.lampVariant} />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                sideOffset={8}
                className="max-w-xs border border-slate-300 bg-slate-100 text-slate-900 shadow-xl text-balance"
              >
                <p className="font-semibold">
                  餘電燈號：{lampConfig.label}（未儲存餘電 {unstoredSurplusKw.toFixed(3)} kW）
                </p>
                <p className="mt-2 font-normal opacity-90">
                  註解：若未儲存餘電超過 1 kW-3kW 顯示橘燈；超過 3 kW 顯示紅燈；其餘顯示綠燈。
                </p>
              </TooltipContent>
            </UiTooltip>

            <UiTooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="flex min-w-[88px] flex-col items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900 sm:text-base">儲能SOC燈號</p>
                  <button
                    type="button"
                    aria-label={`儲能SOC燈號：${socLampConfig.label}`}
                    className="flex h-20 w-20 shrink-0 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none ring-0 transition hover:scale-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    <DeclarationStatusLampIcon variant={socLampConfig.lampVariant} />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                sideOffset={8}
                className="max-w-xs border border-slate-300 bg-slate-100 text-slate-900 shadow-xl text-balance"
              >
                <p className="font-semibold">
                  儲能SOC燈號：{socLampConfig.label}（
                  {socLampConfig.label === '正常' ? '沒有超過安全上下限' : '請檢查SOC區間'}）
                </p>
                <p className="mt-2 font-normal opacity-90">
                  註解：若SOC介於0-20%或是80-100% 顯示橘燈(警告)；介於0-10%、90-100%顯示紅燈(異常)；其餘顯示綠燈正常。
                </p>
              </TooltipContent>
            </UiTooltip>

            <UiTooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="flex min-w-[108px] flex-col items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900 sm:text-base">儲能累積量</p>
                  <button
                    type="button"
                    aria-label={`儲能累積有效量：${cumulativeStorageEffectiveKwh.toFixed(1)} kWh，點擊可查看近7天帳本`}
                    onClick={() => {
                      setStorageLedgerFlipped(false);
                      setStorageLedgerHistoryOpen(false);
                      setHistoryQueryStart('');
                      setHistoryQueryEnd('');
                      setStorageLedgerOpen(true);
                    }}
                    className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.45)] transition hover:scale-105 hover:border-amber-300 hover:bg-amber-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                  >
                    <span className="font-black leading-none text-2xl tabular-nums">
                      {cumulativeStorageEffectiveKwh.toFixed(0)}
                    </span>
                    <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">kWh</span>
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                sideOffset={8}
                className="max-w-xs border border-slate-300 bg-slate-100 text-slate-900 shadow-xl text-balance"
              >
                <p className="font-semibold">7天內儲能累積有效量：{cumulativeStorageEffectiveKwh.toFixed(1)} kWh</p>
                <p className="mt-2 font-normal opacity-90">
                  系統只保留最近 7 天有效儲能量，超過 7 天自動歸零；放電時以最早存入的儲能量優先扣減（FIFO）。
                </p>
                <p className="mt-2 font-normal opacity-90">點擊圓形 kWh 圖示可查看「儲能累積量帳本」。</p>
              </TooltipContent>
            </UiTooltip>
          </div>
        </div>

        {resourceExpanded && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-bold text-sky-700">發電資源（G）</p>
              {genResourceTotals.map((item) => (
                <p key={item.id} className="text-sm text-slate-800">
                  {item.id} 合計 {item.total.toFixed(1)} kW
                </p>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-bold text-rose-700">用電資源（L）</p>
              {loadResourceTotals.map((item) => (
                <p key={item.id} className="text-sm text-slate-800">
                  {item.id} 合計 {item.total.toFixed(1)} kW
                </p>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-bold text-indigo-700">儲能資源（BESS）</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-indigo-200 bg-white p-3">
                  <p className="mb-1 text-xs font-bold uppercase text-indigo-700">充電</p>
                  {bessResourceTotals.map((item) => (
                    <p key={`charge-${item.id}`} className="text-sm text-slate-800">
                      充電{item.id} 合計 {item.charge.toFixed(1)} kW
                    </p>
                  ))}
                </div>
                <div className="rounded-lg border border-violet-200 bg-white p-3">
                  <p className="mb-1 text-xs font-bold uppercase text-violet-700">放電</p>
                  {bessResourceTotals.map((item) => (
                    <p key={`discharge-${item.id}`} className="text-sm text-slate-800">
                      放電{item.id} 合計 {item.discharge.toFixed(1)} kW
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">全資源覆蓋趨勢圖（kW）</h3>
              <p className="mt-1 text-xs text-slate-600">
                「合約數量」曲線：走勢貼近負載，並於 11:00–13:00 額外下調 20kW，表示中午優先將綠電轉入儲能，夜尖峰再運用抵免電價。數值隨所選代理人之合約數量略為調整。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-slate-400 text-slate-800 hover:bg-slate-100"
                onClick={() => openUpload('總表資源上傳')}
              >
                上傳
              </Button>
              <Button
                type="button"
                className="bg-blue-700 text-white hover:bg-blue-800"
                onClick={() => openModify('gen')}
              >
                調整
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ReactECharts option={summaryOption} style={{ height: '100%', width: '100%' }} />
          </div>

        </div>
      </section>

      <section id="declaration-section-renewable" className="scroll-mt-28 space-y-4">
        <h2 className={sectionTitleClass}>3.2 再生能源預測</h2>
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-cyan-500">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-bold text-slate-900">發電明細：PV 曲線案場（kW）</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-cyan-600 text-white hover:bg-cyan-700"
                onClick={() => openModify('gen')}
              >
                調整
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ReactECharts option={genOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </section>

      <section id="declaration-section-load" className="scroll-mt-28 space-y-4">
        <h2 className={sectionTitleClass}>3.3 負載預測</h2>
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-rose-500">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-bold text-slate-900">用電明細：L 系列用戶（kW）</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => openModify('load')}
              >
                調整
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ReactECharts option={loadOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </section>

      <section id="declaration-section-contract-transfer" className="scroll-mt-28 space-y-4">
        <h2 className={sectionTitleClass}>3.4 合約轉供量</h2>
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-amber-500">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">合約轉供量趨勢（kW）</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                每 15 分鐘轉供量基準為 min(再生能源發電合計, 負載合計)，並於 11:00–13:00 另下調 20kW（最低不小於 0），讓中午綠電優先轉入儲能以支援晚間尖峰。藍線為再生能源合計、紅線為負載合計（皆為實線）；綠色虛線與半透明填滿為合約轉供量。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => openModify('gen')}
              >
                調整
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ReactECharts option={contractOption} style={{ height: '100%', width: '100%' }} />
          </div>
          <p className="mt-4 text-xs text-slate-600">
            實際轉供請以台電／市場或後端資料為準；圖表依目前 3.2／3.3 示範資料即時計算。
          </p>
        </div>
      </section>

      <section id="declaration-section-storage" className="scroll-mt-28 space-y-4">
        <h2 className={sectionTitleClass}>3.5 儲能計畫</h2>
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-indigo-600">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">儲能明細：BESS 排程（kW）</h3>
              <p className="mt-1 text-sm font-semibold text-indigo-700">堆疊圖（正值充電、負值放電）</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => openModify('bess')}
              >
                調整
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ReactECharts option={bessOption} style={{ height: '100%', width: '100%' }} />
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">儲能明細：BESS 排程計畫SOC（0~100）</h4>
                <p className="text-sm text-slate-700">填入初始 SOC 即可，其餘時段由系統依充放電排程自動計算。</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={openSocModify}
                >
                  調整
                </Button>
              </div>
            </div>
            <div className={chartWrap}>
              <ReactECharts option={socOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>
      </section>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUploadOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-300 bg-white p-8 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold text-slate-900">{uploadTitle}</h3>
            <div className="mb-8 space-y-4">
              <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-400 bg-slate-100 p-8">
                <i className="fas fa-file-csv mb-3 text-3xl text-blue-600" />
                <p className="mb-4 text-center text-sm font-semibold text-slate-800">拖放或點擊選擇 CSV 檔案</p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) popup('info', '提示', `已選取：${f.name}`);
                  }}
                />
                <Button
                  type="button"
                  className="bg-blue-700 text-white hover:bg-blue-800"
                  onClick={() => csvInputRef.current?.click()}
                >
                  選擇 CSV 檔案
                </Button>
              </div>
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-700">
                支援格式：MVRN 標準 CSV 檔
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-slate-800 hover:bg-slate-100"
                onClick={() => setUploadOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  popup('success', '成功', '已模擬批次更新 G/L/BESS 資料');
                  setUploadOpen(false);
                }}
              >
                完成上傳
              </Button>
            </div>
          </div>
        </div>
      )}

      {modifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModifyOpen(false)} />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-300 bg-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">智慧資源調整面板</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Interval Adjustment（96 時段，範圍依資源類別自動切換）
                </p>
              </div>
              <button type="button" className="text-slate-700 hover:text-slate-900" onClick={() => setModifyOpen(false)}>
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            <div className="grid shrink-0 gap-4 border-b border-slate-300 p-6 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-700">資源類別</label>
                <Select
                  value={modifyCategory}
                  onValueChange={(v) => {
                    setModifyCategory(v as ResourceCategory);
                    setModifyTargetIndex(0);
                  }}
                >
                  <SelectTrigger className="border-slate-400 bg-white text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gen">發電明細 (G)</SelectItem>
                    <SelectItem value="load">用電明細 (L)</SelectItem>
                    <SelectItem value="bess">儲能明細 (BESS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-700">具體對象</label>
                <Select value={String(modifyTargetIndex)} onValueChange={(v) => setModifyTargetIndex(Number(v))}>
                  <SelectTrigger className="border-slate-400 bg-white text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {store[modifyCategory].map((obj, idx) => (
                      <SelectItem key={obj.id} value={String(idx)}>
                        {obj.id} 資源案場
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-700">參考碼</label>
                <Input
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  className="border-slate-400 bg-white font-mono text-sm text-slate-900"
                />
              </div>
            </div>

            <ScrollArea className="h-[50vh] border-b border-slate-300">
              <div>
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white shadow-sm">
                    <tr className="border-b border-slate-300 text-xs font-bold uppercase text-slate-700">
                      <th className="p-3 pl-6">時段</th>
                      <th className="p-3 text-center">調整量 (kW)</th>
                      <th className="p-3 pr-6">滑動調節 ({modifyRange.min}~{modifyRange.max} kW)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INTERVAL_LABELS.map((time, i) => (
                      <tr key={time} className="border-b border-slate-200 hover:bg-slate-100/80">
                        <td className="p-3 pl-6 font-mono text-xs font-semibold text-slate-800">{time}</td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            step="0.001"
                            className="mx-auto w-36 border-slate-400 text-center font-mono text-sm text-slate-900"
                            value={editBuffer[i] ?? 0}
                            onChange={(e) => updateEditValue(i, Number.parseFloat(e.target.value))}
                            onBlur={() => validateIndexOnBlur(i)}
                          />
                        </td>
                        <td className="p-3 pr-6">
                          <Slider
                            min={modifyRange.min}
                            max={modifyRange.max}
                            step={0.001}
                            value={[clampByRange(editBuffer[i] ?? 0, modifyRange.min, modifyRange.max)]}
                            onValueChange={(vals) => updateEditValue(i, vals[0] ?? 0)}
                            onValueCommit={() => validateIndexOnBlur(i)}
                            className="[&_[data-slot=slider-track]]:bg-blue-200 [&_[data-slot=slider-range]]:bg-blue-600 [&_[data-slot=slider-thumb]]:border-blue-600"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>

            <div className="flex shrink-0 flex-wrap gap-3 p-6">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-800 hover:bg-slate-100"
                onClick={() => setModifyOpen(false)}
              >
                放棄調整
              </Button>
              <Button
                type="button"
                className="flex-1 bg-blue-700 text-white hover:bg-blue-800 sm:flex-none sm:px-10"
                onClick={saveModify}
              >
                確認提交變更並更新圖表
              </Button>
            </div>
          </div>
        </div>
      )}

      {socModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSocModalOpen(false)} />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">設定初始 SOC（%）</h3>
            <p className="mt-1 text-sm text-slate-700">只需填寫各儲能站初始SOC，後續由系統自動推算。</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {store.bess.map((item, idx) => (
                <div key={`soc-init-${item.id}`}>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-700">{item.id} 初始SOC</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={socEditBuffer[idx] ?? 0}
                    onChange={(e) => {
                      const next = [...socEditBuffer];
                      next[idx] = Number.parseFloat(e.target.value);
                      setSocEditBuffer(next);
                    }}
                    className="border-slate-400 bg-white text-slate-900"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setSocModalOpen(false)}>
                取消
              </Button>
              <Button type="button" className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={saveSocInitial}>
                儲存
              </Button>
            </div>
          </div>
        </div>
      )}

      {storageLedgerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setStorageLedgerFlipped(false);
              setStorageLedgerHistoryOpen(false);
              setHistoryQueryStart('');
              setHistoryQueryEnd('');
              setStorageLedgerOpen(false);
            }}
          />
          <div className="relative z-10 w-full max-w-[min(980px,100%)] overflow-visible [perspective:2000px]">
            <button
              type="button"
              aria-label="關閉帳本"
              onClick={() => {
                setStorageLedgerFlipped(false);
                setStorageLedgerHistoryOpen(false);
                setHistoryQueryStart('');
                setHistoryQueryEnd('');
                setStorageLedgerOpen(false);
              }}
              className="absolute -right-12 -top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-md transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
            >
              <i className="fas fa-times text-sm" />
            </button>
            <div
              className="relative mx-auto w-full overflow-visible rounded-2xl [transform-style:preserve-3d]"
              style={{
                aspectRatio: '1024 / 588',
                width: 'min(980px, calc(100vw - 2rem), calc(85vh * 1024 / 588))',
                maxWidth: '100%',
              }}
            >
              {/* 內頁外框固定與封面四角對齊；內容位置再依翻頁狀態內縮 */}
              <div className="absolute inset-0 z-10 overflow-hidden rounded-2xl">
                <PassbookWithPageEdge showEdge={storageLedgerFlipped}>
                  <div
                    className={cn(
                      'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e3d5bc] bg-[#fffdf5] p-4 shadow-[0_12px_35px_rgba(15,23,42,0.18)] sm:p-5',
                      storageLedgerFlipped ? 'pt-[8%] sm:pt-[7%]' : 'pt-3 sm:pt-4',
                      storageLedgerFlipped &&
                        'border-[#dccfb5] shadow-[0_12px_35px_rgba(15,23,42,0.16),inset_0_4px_0_rgba(255,255,255,0.65),inset_0_-6px_16px_rgba(70,55,35,0.07),inset_-6px_0_16px_rgba(85,65,40,0.1),inset_0_6px_16px_rgba(85,65,40,0.07)]'
                    )}
                  >
                    {storageLedgerHistoryOpen ? (
                      <>
                        <div className="mb-3 shrink-0 space-y-3 border-b border-slate-200 pb-3">
                          <button
                            type="button"
                            onClick={() => setStorageLedgerHistoryOpen(false)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-blue-700"
                          >
                            <i className="fas fa-chevron-left" />
                            收回查詢歷史 CLOSE
                          </button>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                查詢起日
                              </label>
                              <Input
                                type="date"
                                value={historyQueryStart}
                                onChange={(e) => setHistoryQueryStart(e.target.value)}
                                className="h-9 border-slate-300 bg-white font-mono text-sm text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                查詢迄日
                              </label>
                              <Input
                                type="date"
                                value={historyQueryEnd}
                                onChange={(e) => setHistoryQueryEnd(e.target.value)}
                                className="h-9 border-slate-300 bg-white font-mono text-sm text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 space-y-2 overflow-auto font-mono text-sm">
                          {!historyQueryStart || !historyQueryEnd ? (
                            <p className="py-10 text-center text-sm text-slate-600">
                              請於上方分別選擇查詢起日與查詢迄日
                            </p>
                          ) : (
                            <>
                              <div className="sticky top-0 z-[1] mb-2 grid grid-cols-3 border-b border-slate-300 bg-[#fffdf5] pb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                <span>時間 (Date)</span>
                                <span className="text-center">電能累積量 (MWh)</span>
                                <span className="text-right">狀態 (Status)</span>
                              </div>
                              {storageHistoryRows.map((row) => (
                                <div
                                  key={row.dateLabel}
                                  className="grid grid-cols-3 rounded-lg bg-slate-50 px-2 py-2 text-slate-800"
                                >
                                  <span>{row.dateLabel}</span>
                                  <span className="text-center">
                                    {row.netMwh >= 0 ? '+' : ''}
                                    {row.netMwh.toFixed(3)} MWh
                                  </span>
                                  <span className="text-right text-[11px] font-bold leading-snug">
                                    <span className="block text-slate-800">已登記</span>
                                    {row.expiredMwh > 0 && (
                                      <span className="mt-0.5 block font-semibold text-amber-800">
                                        過期量 {row.expiredMwh.toFixed(3)} MWh
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                        <div className="mt-3 shrink-0 border-t border-dashed border-slate-300 pt-3 text-right">
                          <p className="text-xs font-black uppercase tracking-widest text-blue-900">
                            於選取時間累積的過期放電量
                          </p>
                          <p className="mt-1 text-lg font-black text-blue-900">
                            {historyExpiredRangeMwh.toFixed(3)} MWh
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-3 shrink-0 grid grid-cols-3 border-b border-slate-300 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <span>時間 (Date)</span>
                          <span className="text-center">電能累積 (MWh)</span>
                          <span className="text-right">狀態 (Status)</span>
                        </div>
                        <div className="min-h-0 flex-1 space-y-2 overflow-auto font-mono text-sm">
                          {storageLedgerRows.map((row) => (
                            <div
                              key={row.dateLabel}
                              className={`grid grid-cols-3 rounded-lg px-2 py-2 ${
                                row.expired
                                  ? 'animate-pulse bg-red-50 text-base font-black text-red-900'
                                  : 'bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>{row.dateLabel}</span>
                              <span className="text-center">
                                {row.netMwh >= 0 ? '+' : ''}
                                {row.netMwh.toFixed(3)} MWh
                              </span>
                              <span className="self-center text-right text-[11px] font-bold uppercase">
                                {row.status}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 shrink-0 border-t border-dashed border-slate-300 pt-3 text-right">
                          <p className="text-xs font-black uppercase tracking-widest text-blue-900">
                            累積過期放電量 Total Expired
                          </p>
                          <p className="mt-1 text-lg font-black text-blue-900">{totalExpiredMwh.toFixed(3)} MWh</p>
                        </div>
                        <p className="mt-4 shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-semibold leading-relaxed text-blue-900">
                          此帳本記錄近 7 日儲能累積量；超過 7 天即失效，放電採先進先出（FIFO）扣減。
                        </p>
                        <div className="mt-4 flex shrink-0 justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const end = new Date(`${selectedDate}T12:00:00`);
                              const start = new Date(end);
                              start.setDate(start.getDate() - 13);
                              setHistoryQueryStart(start.toISOString().slice(0, 10));
                              setHistoryQueryEnd(end.toISOString().slice(0, 10));
                              setStorageLedgerHistoryOpen(true);
                            }}
                            className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2 text-xs font-black uppercase tracking-widest text-white shadow-md transition hover:bg-slate-800"
                          >
                            歷史紀錄 OPEN
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </PassbookWithPageEdge>
              </div>

              <div
                className={cn(
                  'absolute inset-0 z-20 rounded-2xl [transform-origin:top] [transform-style:preserve-3d] transition-transform duration-1000',
                  storageLedgerFlipped ? '[transform:rotateX(155deg)]' : '[transform:rotateX(0deg)]'
                )}
              >
                <div
                  className="absolute inset-0 rounded-2xl border border-slate-700 bg-cover bg-center [backface-visibility:hidden]"
                  style={{ backgroundImage: `url('${storagePassbookCoverUrl}')` }}
                >
                  <div className="absolute inset-0 rounded-2xl bg-slate-900/25" />
                  <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
                    <button
                      type="button"
                      onClick={() => setStorageLedgerFlipped(true)}
                      className="rounded-full border border-white/70 bg-black/45 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-black/60"
                    >
                      點擊翻開 OPEN
                    </button>
                  </div>
                </div>
                <div className="absolute inset-0 rounded-2xl border border-slate-200 bg-[#fffdf5] px-6 py-6 text-slate-700 [backface-visibility:hidden] [transform:rotateX(180deg)]">
                  <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
                    <button
                      type="button"
                      onClick={() => {
                        setStorageLedgerFlipped(false);
                        setStorageLedgerHistoryOpen(false);
                        setHistoryQueryStart('');
                        setHistoryQueryEnd('');
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-blue-600"
                    >
                      <i className="fas fa-chevron-up" />
                      收回封面 CLOSE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
