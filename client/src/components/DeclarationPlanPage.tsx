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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal, { type SweetAlertIcon } from 'sweetalert2';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Label,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const INTERVAL_COUNT = 96;
const GENERATION_MIN_KW = 0;
const GENERATION_MAX_KW = 50;
const LOAD_MIN_KW = 0;
const LOAD_MAX_KW = 50;
const BESS_MIN_KW = -50;
const BESS_MAX_KW = 50;

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

/** 合約轉供示意：11:00–13:00 明顯低於負載，表示中午多餘綠電轉儲能／調度，夜尖峰再抵免用電 */
function contractTransferShapeMultiplier(intervalIndex: number): number {
  const h = getHourByIndex(intervalIndex);
  if (h < 10.875) return 1;
  if (h < 11) return 1 - 0.16 * ((h - 10.875) / 0.125);
  if (h < 13) return 0.78;
  if (h < 13.125) return 0.78 + 0.16 * ((h - 13) / 0.125);
  return 1;
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

function isDischargeWindow(index: number): boolean {
  const h = getHourByIndex(index);
  return h >= 16 && h < 20;
}

function pvCurve(hour: number): number {
  if (hour < 6 || hour > 18) return 0;
  const x = (hour - 12) / 6;
  return Math.max(0, Math.exp(-x * x * 2.2));
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
        const withNoise = cap * pv + (i + 1) * 0.15;
        return clampByRange(withNoise, GENERATION_MIN_KW, GENERATION_MAX_KW);
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
  },
] as const;

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
  const [socEditBuffer, setSocEditBuffer] = useState<number[]>([45, 53, 61]);
  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Record<string, boolean>>({});
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
    const agent = AGENT_PROFILES.find((a) => a.id === selectedAgentId) ?? AGENT_PROFILES[1];
    const contractCount = Math.max(1, agent.contractCodes.length);
    return INTERVAL_LABELS.map((time, i) => {
      const loadVal = sumSeriesAt(store, 'load', i);
      const shape = contractTransferShapeMultiplier(i);
      const contractQty =
        loadVal * (0.94 + Math.min(contractCount, 8) * 0.01) * shape;
      return {
        time,
        gen: sumSeriesAt(store, 'gen', i),
        load: loadVal,
        bess: sumSeriesAt(store, 'bess', i),
        contractQty: Number(contractQty.toFixed(3)),
      };
    });
  }, [store, selectedAgentId]);

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
    return INTERVAL_LABELS.map((time, i) => {
      const row: Record<string, string | number> = { time };
      store.bess.forEach((g, j) => {
        row[`b${j}`] = g.data[i];
      });
      return row;
    });
  }, [store]);

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
        const charge = series.data.reduce((acc, val) => acc + (val > 0 ? val : 0), 0) / 4;
        const discharge = series.data.reduce((acc, val) => acc + (val < 0 ? Math.abs(val) : 0), 0) / 4;
        return { id: series.id, charge, discharge };
      }),
    [store.bess]
  );

  const bessSocRows = useMemo(() => {
    const seriesSoc = store.bess.map((series, seriesIdx) => {
      const initialSoc = clampByRange(socInitialValues[seriesIdx] ?? 50, 0, 100);
      const socData: number[] = [];
      let soc = initialSoc;
      series.data.forEach((kw) => {
        // 15 分鐘轉換為 SOC 變化比例（示意邏輯）
        const delta = (kw / 12) * 2.2;
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

  const chartWrap = 'h-[320px] w-full min-h-[280px]';
  const sectionTitleClass = 'border-b border-slate-300 pb-2 text-lg font-bold text-slate-900';
  const axisStyle = { fontSize: 10, fill: '#0f172a' };
  const tooltipFormatter = (value: number) => [`${Number(value).toFixed(3)} kW`, ''];
  const modifyRange = getRangeByCategory(modifyCategory);
  const toggleLegend = (key: string) => {
    if (!key) return;
    setHiddenSeriesKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const isSeriesHidden = (key: string) => Boolean(hiddenSeriesKeys[key]);

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
      ? { color: 'bg-red-500', text: 'text-red-700', label: '危險', icon: 'fas fa-triangle-exclamation' }
      : unstoredSurplusKw > 1
        ? { color: 'bg-orange-500', text: 'text-orange-700', label: '注意', icon: 'fas fa-circle-exclamation' }
        : { color: 'bg-emerald-500', text: 'text-emerald-700', label: '正常', icon: 'fas fa-circle-check' };
  const socLampConfig = socHasRed
    ? { color: 'bg-red-500', text: 'text-red-700', label: '異常', icon: 'fas fa-triangle-exclamation' }
    : socHasOrange
      ? { color: 'bg-orange-500', text: 'text-orange-700', label: '警告', icon: 'fas fa-circle-exclamation' }
      : { color: 'bg-emerald-500', text: 'text-emerald-700', label: '正常', icon: 'fas fa-circle-check' };

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-slate-600">申報設定</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">每日申報計劃</h2>
            <p className="mt-2 text-sm text-slate-600">請選擇代理人與日期，執行 15 分鐘區間申報。</p>

            <button
              type="button"
              onClick={() => setAgentDetailExpanded((v) => !v)}
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-blue-700 transition"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-slate-50 text-xs leading-none">
                {agentDetailExpanded ? '−' : '+'}
              </span>
              詳細資訊
            </button>

            {agentDetailExpanded && (
              <div className="mt-4 max-w-lg rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-sm">
                <dl className="space-y-5">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">代理人名稱</dt>
                    <dd className="mt-1 font-bold text-slate-900">{selectedAgent.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">統編</dt>
                    <dd className="mt-1 font-bold text-slate-900">{selectedAgent.taxId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">合約代號</dt>
                    <dd className="mt-1 space-y-3 font-semibold text-slate-900">
                      {selectedAgent.contractCodes.map((code) => (
                        <p key={code}>{code}</p>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">合約數量</dt>
                    <dd className="mt-1 font-bold text-slate-900">{selectedAgent.contractCodes.length}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-4 sm:flex-row xl:w-auto xl:min-w-[320px] xl:flex-col xl:gap-4">
            <div className="min-w-0 flex-1 sm:flex-1 xl:flex-none">
              <label className="mb-2 block text-xs font-bold uppercase text-slate-700">代理人名稱</label>
              <Select value={selectedAgent.id} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-full border-slate-300 bg-white text-slate-900">
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
            <div className="min-w-0 flex-1 sm:flex-1 xl:flex-none">
              <label className="mb-2 block text-xs font-bold uppercase text-slate-700">申報日期</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border-slate-300 bg-white text-slate-900"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="declaration-section-total" className="scroll-mt-28 space-y-6">
        <h2 className={sectionTitleClass}>3.1 總量</h2>
        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm space-y-2">
          <p className={`text-sm font-bold ${lampConfig.text}`}>
            <span className={`mr-2 inline-flex h-3.5 w-3.5 rounded-full ${lampConfig.color}`} />
            餘電燈號：{lampConfig.label}（未儲存餘電 {unstoredSurplusKw.toFixed(3)} kW）
          </p>
          <p className="text-xs text-slate-700">
            註解：若未儲存餘電超過 1 kW-3kW 顯示橘燈；超過 3 kW 顯示紅燈；其餘顯示綠燈。
          </p>
          <p className={`text-sm font-bold ${socLampConfig.text}`}>
            <span className={`mr-2 inline-flex h-3.5 w-3.5 rounded-full ${socLampConfig.color}`} />
            儲能SOC燈號：{socLampConfig.label} ({socLampConfig.label === '正常' ? '沒有超過安全上下限' : '請檢查SOC區間'})
          </p>
          <p className="text-xs text-slate-700">
            註解：若SOC介於0-20%或是80-100% 顯示橘燈(警告)；介於0-10%、90-100%顯示紅燈(異常)；其餘顯示綠燈正常。
          </p>
          <p className="text-sm font-bold text-indigo-700">
            <i className="fas fa-clock mr-2" />
            儲能只可以在10:00-14:00充電、放電只可以在16:00-20:00之間
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SUMMARY_CARD_STATS.map((card) => (
            <div
              key={card.title}
              className={`rounded-2xl border border-slate-300 bg-white p-6 shadow-sm border-t-4 ${card.accent}`}
            >
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
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <Button
            type="button"
            variant="outline"
            className="border-slate-400 text-slate-800 hover:bg-slate-100"
            onClick={() => setResourceExpanded((prev) => !prev)}
          >
            <i className={`fas ${resourceExpanded ? 'fa-minus' : 'fa-plus'} mr-2`} />
            各資源名稱
          </Button>

          {resourceExpanded && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        </div>

        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">全資源覆蓋趨勢圖（kW）</h3>
              <p className="mt-1 text-xs text-slate-600">
                「合約數量」為示意曲線（kW）：走勢貼近負載，11:00–13:00 較低表示中午將多餘綠電轉入儲能／合約調度；夜尖峰再運用抵免電價。數值隨所選代理人之合約數量略為調整。
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
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={summaryRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                <XAxis dataKey="time" tick={axisStyle} interval={7} />
                <YAxis tick={axisStyle}>
                  <Label value="kW" angle={-90} position="insideLeft" fill="#0f172a" />
                </YAxis>
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', color: '#0f172a' }}
                  formatter={tooltipFormatter}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#0f172a', cursor: 'pointer' }}
                  onClick={(entry) => toggleLegend((entry as { dataKey?: string }).dataKey ?? '')}
                />
                <Line
                  type="monotone"
                  dataKey="gen"
                  hide={isSeriesHidden('gen')}
                  name="發電 (kW)"
                  stroke="#0ea5e9"
                  strokeWidth={2.2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="load"
                  hide={isSeriesHidden('load')}
                  name="用電 (kW)"
                  stroke="#ef4444"
                  strokeWidth={2.2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="contractQty"
                  hide={isSeriesHidden('contractQty')}
                  name="合約數量 (示意 kW)"
                  stroke="#d97706"
                  strokeWidth={2.2}
                  dot={false}
                />
                <Bar
                  dataKey="bess"
                  hide={isSeriesHidden('bess')}
                  name="儲能 (kW)"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  barSize={6}
                />
              </ComposedChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={genRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                <XAxis dataKey="time" tick={axisStyle} interval={7} />
                <YAxis tick={axisStyle}>
                  <Label value="kW" angle={-90} position="insideLeft" fill="#0f172a" />
                </YAxis>
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', color: '#0f172a' }}
                  formatter={tooltipFormatter}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#0f172a', cursor: 'pointer' }}
                  onClick={(entry) => toggleLegend((entry as { dataKey?: string }).dataKey ?? '')}
                />
                {store.gen.map((obj, i) => (
                  <Line
                    key={obj.id}
                    type="monotone"
                    dataKey={`g${i}`}
                    hide={isSeriesHidden(`g${i}`)}
                    name={`場號 ${obj.id} (kW)`}
                    stroke={GEN_LINE_COLORS[i % GEN_LINE_COLORS.length]}
                    strokeWidth={2.2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                <XAxis dataKey="time" tick={axisStyle} interval={7} />
                <YAxis tick={axisStyle}>
                  <Label value="kW" angle={-90} position="insideLeft" fill="#0f172a" />
                </YAxis>
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', color: '#0f172a' }}
                  formatter={tooltipFormatter}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#0f172a', cursor: 'pointer' }}
                  onClick={(entry) => toggleLegend((entry as { dataKey?: string }).dataKey ?? '')}
                />
                {store.load.map((obj, i) => (
                  <Line
                    key={obj.id}
                    type="monotone"
                    dataKey={`l${i}`}
                    hide={isSeriesHidden(`l${i}`)}
                    name={`用戶 ${obj.id} (kW)`}
                    stroke={LOAD_LINE_COLORS[i % LOAD_LINE_COLORS.length]}
                    strokeWidth={2.2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section id="declaration-section-contract-transfer" className="scroll-mt-28 space-y-4">
        <h2 className={sectionTitleClass}>3.4 合約轉供量</h2>
        <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-amber-500">
          <h3 className="text-base font-bold text-slate-900">合約轉供與時段策略</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            本區說明依合約約定之轉供電量與時段安排。與 3.1 總量圖中的「合約數量」示意線呼應：曲線大致跟隨負載，於中午
            11:00–13:00 明顯較低，代表將多餘再生能源透過儲能或合約機制保留；於夜間尖峰時段再釋出，以配合電價抵免或市場申報策略。
          </p>
          <p className="mt-3 text-sm text-slate-600">
            實際轉供量請以台電／市場介面或後端 API 為準；此處為前端展示與教育說明用。
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bessRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                <XAxis dataKey="time" tick={axisStyle} interval={7} />
                <YAxis tick={axisStyle}>
                  <Label value="kW" angle={-90} position="insideLeft" fill="#0f172a" />
                </YAxis>
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', color: '#0f172a' }}
                  formatter={tooltipFormatter}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#0f172a', cursor: 'pointer' }}
                  onClick={(entry) => toggleLegend((entry as { dataKey?: string }).dataKey ?? '')}
                />
                {store.bess.map((obj, i) => (
                  <Bar
                    key={obj.id}
                    dataKey={`b${i}`}
                    hide={isSeriesHidden(`b${i}`)}
                    name={`儲能站 ${obj.id} (kW)`}
                    stackId="bess"
                    fill={BESS_BAR_COLORS[i % BESS_BAR_COLORS.length]}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bessSocRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
                  <XAxis dataKey="time" tick={axisStyle} interval={7} />
                  <YAxis tick={axisStyle} domain={[0, 100]}>
                    <Label value="SOC (%)" angle={-90} position="insideLeft" fill="#0f172a" />
                  </YAxis>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', color: '#0f172a' }}
                    formatter={(value: number) => [`${Number(value).toFixed(1)} %`, '']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: '#0f172a', cursor: 'pointer' }}
                    onClick={(entry) => toggleLegend((entry as { dataKey?: string }).dataKey ?? '')}
                  />
                  {store.bess.map((obj, i) => (
                    <Line
                      key={`soc-${obj.id}`}
                      type="monotone"
                      dataKey={`soc${i}`}
                      hide={isSeriesHidden(`soc${i}`)}
                      name={`SOC ${obj.id} (%)`}
                      stroke={BESS_BAR_COLORS[i % BESS_BAR_COLORS.length]}
                      strokeWidth={2.2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
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
    </div>
  );
}
