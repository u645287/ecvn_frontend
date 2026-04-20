import { useRegistration, type PlanSection } from '@/contexts/RegistrationContext';
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
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const INTERVAL_COUNT = 96;

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

type ResourceCategory = 'gen' | 'load' | 'bess';

type ResourceSeries = { id: string; data: number[] };

function createInitialStore(): Record<ResourceCategory, ResourceSeries[]> {
  return {
    gen: [1, 2, 3, 4, 5].map((i) => ({
      id: `G${i}`,
      data: INTERVAL_LABELS.map(() => 10 + i * 5 + Math.random() * 5),
    })),
    load: [1, 2, 3, 4, 5].map((i) => ({
      id: `L${i}`,
      data: INTERVAL_LABELS.map(() => 15 + i * 3 + Math.random() * 2),
    })),
    bess: [1, 2, 3].map((i) => ({
      id: `B${i}`,
      data: INTERVAL_LABELS.map(() => (Math.random() > 0.8 ? Math.random() * 20 - 10 : 0)),
    })),
  };
}

function sumSeriesAt(store: Record<ResourceCategory, ResourceSeries[]>, cat: ResourceCategory, i: number) {
  return store[cat].reduce((acc, s) => acc + s.data[i], 0);
}

function totalMwhFrom96(data: number[]): number {
  return data.reduce((a, b) => a + b, 0) / 4;
}

const NAV_ITEMS: { section: PlanSection; label: string }[] = [
  { section: 'total', label: '3.1 總量' },
  { section: 'load', label: '3.2 負載預測' },
  { section: 'renewable', label: '3.3 再生能源預測' },
  { section: 'storage', label: '3.4 儲能計畫' },
  { section: 'cop', label: '3.5 COP 申報與公告' },
];

const GEN_LINE_COLORS = ['#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a'];
const LOAD_LINE_COLORS = ['#15803d', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'];
const BESS_BAR_COLORS = ['#3730a3', '#4f46e5', '#6366f1'];

export default function DeclarationPlanPage() {
  const {
    declarationPlanSection,
    declarationPlanNavSeq,
    currentView,
    goDeclarationPlanSection,
  } = useRegistration();

  const [store, setStore] = useState(createInitialStore);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('資料上傳');
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyCategory, setModifyCategory] = useState<ResourceCategory>('gen');
  const [modifyTargetIndex, setModifyTargetIndex] = useState(0);
  const [refCode, setRefCode] = useState('REF-EDIT-99');
  const [editBuffer, setEditBuffer] = useState<number[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentView !== 'declaration-plan') return;
    const el = document.getElementById(`declaration-section-${declarationPlanSection}`);
    requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [currentView, declarationPlanSection, declarationPlanNavSeq]);

  const summaryRows = useMemo(() => {
    return INTERVAL_LABELS.map((time, i) => ({
      time,
      gen: sumSeriesAt(store, 'gen', i),
      load: sumSeriesAt(store, 'load', i),
      bess: sumSeriesAt(store, 'bess', i),
    }));
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
    return INTERVAL_LABELS.map((time, i) => {
      const row: Record<string, string | number> = { time };
      store.bess.forEach((g, j) => {
        row[`b${j}`] = g.data[i];
      });
      return row;
    });
  }, [store]);

  const statGen = useMemo(
    () => totalMwhFrom96(INTERVAL_LABELS.map((_, i) => sumSeriesAt(store, 'gen', i))),
    [store]
  );
  const statLoad = useMemo(
    () => totalMwhFrom96(INTERVAL_LABELS.map((_, i) => sumSeriesAt(store, 'load', i))),
    [store]
  );
  const statBess = useMemo(
    () => totalMwhFrom96(INTERVAL_LABELS.map((_, i) => sumSeriesAt(store, 'bess', i))),
    [store]
  );

  const settlementDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const openUpload = (title: string) => {
    setUploadTitle(title);
    setUploadOpen(true);
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

  const updateEditValue = useCallback((index: number, value: number) => {
    setEditBuffer((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const saveModify = () => {
    const newData = editBuffer.map((v) => (Number.isFinite(v) ? v : 0));
    setStore((prev) => ({
      ...prev,
      [modifyCategory]: prev[modifyCategory].map((s, i) =>
        i === modifyTargetIndex ? { ...s, data: newData } : s
      ),
    }));
    toast.success(
      `資源 ${store[modifyCategory][modifyTargetIndex]?.id} 已更新，參考碼：${refCode}`
    );
    setModifyOpen(false);
  };

  const chartWrap = 'h-[320px] w-full min-h-[280px]';

  return (
    <div className="space-y-6 pb-10">
      {/* 區內導覽 */}
      <nav className="sticky top-0 z-[5] -mx-2 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        {NAV_ITEMS.map(({ section, label }) => (
          <Button
            key={section}
            type="button"
            variant={declarationPlanSection === section ? 'default' : 'outline'}
            size="sm"
            className={
              declarationPlanSection === section
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border-slate-200 bg-white'
            }
            onClick={() => goDeclarationPlanSection(section)}
          >
            {label}
          </Button>
        ))}
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">MVRN 智慧資源調度</h1>
          <p className="text-sm font-medium text-slate-500">進階調度與批次修改（示範資料）</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700">
          <i className="fas fa-clock" />
          結算日期：{settlementDate}
        </div>
      </header>

      {/* 3.1 總量 */}
      <section id="declaration-section-total" className="scroll-mt-28 space-y-6">
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">3.1 總量</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm border-t-4 border-t-amber-400">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">發電總量 (G)</p>
            <p className="text-3xl font-bold text-slate-800">
              {statGen.toFixed(1)} <span className="text-sm font-normal text-slate-500">MWh</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm border-t-4 border-t-emerald-500">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">用電總量 (L)</p>
            <p className="text-3xl font-bold text-slate-800">
              {statLoad.toFixed(1)} <span className="text-sm font-normal text-slate-500">MWh</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm border-t-4 border-t-indigo-600">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">儲能狀態 (BESS)</p>
            <p className="text-3xl font-bold text-slate-800">
              {statBess.toFixed(1)} <span className="text-sm font-normal text-slate-500">MWh</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-bold text-slate-800">全資源覆蓋趨勢圖</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-200" onClick={() => openUpload('總表資源上傳')}>
                上傳
              </Button>
              <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => openModify('gen')}>
                調整
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={summaryRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={7} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="gen" name="發電 (G)" stroke="#ca8a04" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="load"
                  name="用電 (L)"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Bar dataKey="bess" name="儲能 (BESS)" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={6} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3.2 負載預測 */}
      <section id="declaration-section-load" className="scroll-mt-28 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">3.2 負載預測</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-emerald-500/80">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-bold text-slate-800">用電明細：L 系列用戶</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-200" onClick={() => openUpload('用電用戶資料上傳')}>
                上傳
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => openModify('load')}
              >
                修改
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={7} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {store.load.map((obj, i) => (
                  <Line
                    key={obj.id}
                    type="monotone"
                    dataKey={`l${i}`}
                    name={`用戶 ${obj.id}`}
                    stroke={LOAD_LINE_COLORS[i % LOAD_LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3.3 再生能源預測 */}
      <section id="declaration-section-renewable" className="scroll-mt-28 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">3.3 再生能源預測</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-amber-500/80">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-bold text-slate-800">發電明細：G 系列案場</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-200" onClick={() => openUpload('發電案場資料上傳')}>
                上傳
              </Button>
              <Button
                type="button"
                className="bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => openModify('gen')}
              >
                修改
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={genRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={7} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {store.gen.map((obj, i) => (
                  <Line
                    key={obj.id}
                    type="monotone"
                    dataKey={`g${i}`}
                    name={`場號 ${obj.id}`}
                    stroke={GEN_LINE_COLORS[i % GEN_LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3.4 儲能計畫 */}
      <section id="declaration-section-storage" className="scroll-mt-28 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">3.4 儲能計畫</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 border-t-4 border-t-indigo-500/80">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-bold text-slate-800">儲能明細：BESS 排程</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-200" onClick={() => openUpload('儲能站點資料上傳')}>
                上傳
              </Button>
              <Button
                type="button"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => openModify('bess')}
              >
                修改
              </Button>
            </div>
          </div>
          <div className={chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bessRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={7} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {store.bess.map((obj, i) => (
                  <Bar
                    key={obj.id}
                    dataKey={`b${i}`}
                    name={`儲能站 ${obj.id}`}
                    stackId="bess"
                    fill={BESS_BAR_COLORS[i % BESS_BAR_COLORS.length]}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3.5 COP */}
      <section id="declaration-section-cop" className="scroll-mt-28 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">3.5 COP 申報與公告</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            此區用於 COP（Capacity Obligation Program）相關申報與市場公告檢視。以下為介面占位，實際送出須對接後端 API。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="bg-slate-900 text-white hover:bg-slate-800">
              <i className="fas fa-file-signature mr-2" />
              申報草稿
            </Button>
            <Button type="button" variant="outline" className="border-slate-200">
              <i className="fas fa-bullhorn mr-2" />
              公告紀錄
            </Button>
          </div>
        </div>
      </section>

      {/* 上傳 Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setUploadOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold text-slate-900">{uploadTitle}</h3>
            <div className="mb-8 space-y-4">
              <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8">
                <i className="fas fa-file-csv mb-3 text-3xl text-blue-500" />
                <p className="mb-4 text-center text-sm font-semibold text-slate-600">拖放或點擊選擇 CSV 檔案</p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) toast.message(`已選取：${f.name}（示範：未實際解析）`);
                  }}
                />
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => csvInputRef.current?.click()}
                >
                  選擇 CSV 檔案
                </Button>
              </div>
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                支援格式：MVRN 標準 CSV 檔
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setUploadOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  toast.success('示範：已模擬批次更新 G/L/BESS 資料');
                  setUploadOpen(false);
                }}
              >
                完成上傳
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 修改 Modal */}
      {modifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setModifyOpen(false)} />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">智慧資源修改面板</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  MVRN Detailed Interval Adjustment（96 時段）
                </p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setModifyOpen(false)}>
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            <div className="grid shrink-0 gap-4 border-b border-slate-100 p-6 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-500">資源類別</label>
                <Select
                  value={modifyCategory}
                  onValueChange={(v) => {
                    setModifyCategory(v as ResourceCategory);
                    setModifyTargetIndex(0);
                  }}
                >
                  <SelectTrigger className="border-slate-200 bg-white">
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
                <label className="mb-2 block text-xs font-bold uppercase text-slate-500">具體對象</label>
                <Select
                  value={String(modifyTargetIndex)}
                  onValueChange={(v) => setModifyTargetIndex(Number(v))}
                >
                  <SelectTrigger className="border-slate-200 bg-white">
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
                <label className="mb-2 block text-xs font-bold uppercase text-slate-500">MVRN 參考碼</label>
                <Input
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  className="border-slate-200 bg-white font-mono text-sm"
                />
              </div>
            </div>

            <ScrollArea className="h-[50vh] border-b border-slate-100">
              <div>
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white shadow-sm">
                    <tr className="border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                      <th className="p-3 pl-6">時段</th>
                      <th className="p-3 text-center">調整量</th>
                      <th className="p-3 pr-6">滑動調節</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INTERVAL_LABELS.map((time, i) => (
                      <tr key={time} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="p-3 pl-6 font-mono text-xs font-semibold text-slate-600">{time}</td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            step="0.001"
                            className="mx-auto w-28 border-slate-200 text-center font-mono text-sm"
                            value={editBuffer[i] ?? 0}
                            onChange={(e) => updateEditValue(i, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-3 pr-6">
                          <Slider
                            min={-50}
                            max={100}
                            step={0.001}
                            value={[editBuffer[i] ?? 0]}
                            onValueChange={(vals) => updateEditValue(i, vals[0] ?? 0)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>

            <div className="flex shrink-0 flex-wrap gap-3 p-6">
              <Button type="button" variant="ghost" onClick={() => setModifyOpen(false)}>
                放棄修改
              </Button>
              <Button
                type="button"
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none sm:px-10"
                onClick={saveModify}
              >
                確認提交變更並更新圖表
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
