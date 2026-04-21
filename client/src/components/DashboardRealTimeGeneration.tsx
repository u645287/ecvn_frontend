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
import type { Agent } from '@/data/agentAggregation';
import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { useMemo, useState } from 'react';

/** 參考 2.3 頁面快照：預設表號的示範即時功率與通訊狀態（與主檔表號一致時優先採用） */
const DEMO_KW_BY_METER: Record<string, { kw: number; ok: boolean }> = {
  M109876543: { kw: 820.9, ok: true },
  M208877665: { kw: 664.5, ok: true },
  M508877611: { kw: 931.3, ok: false },
  M508877622: { kw: 1353.0, ok: true },
  M700033344: { kw: 430.1, ok: true },
  M807777788: { kw: 1147.9, ok: true },
  M909123499: { kw: 1560.5, ok: true },
};

function hashToUnit(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString('zh-TW', { hour: 'numeric', minute: '2-digit', hour12: true });
}

type MeterRow = {
  agentId: number;
  agentName: string;
  meterNo: string;
  siteName: string;
  kw: number;
  capacityKw: number;
  renewable: 'PV' | 'WIND';
  ok: boolean;
};

function buildRows(agents: Agent[], refreshSeq: number): MeterRow[] {
  const rows: MeterRow[] = [];
  for (const agent of agents) {
    for (const asset of agent.genList) {
      const meterNo = asset.meterNo ?? asset.no;
      const demo = DEMO_KW_BY_METER[meterNo];
      const noise = 0.97 + hashToUnit(`${meterNo}:${asset.id}`, refreshSeq) * 0.06;
      const baseKw = demo ? demo.kw * noise : Math.round(asset.capacityKw * (0.48 + hashToUnit(asset.id, refreshSeq) * 0.35) * 10) / 10;
      const ok = demo ? demo.ok : true;
      const renewable = asset.renewableType ?? 'PV';
      rows.push({
        agentId: agent.id,
        agentName: agent.name,
        meterNo,
        siteName: asset.name,
        kw: Math.round(baseKw * 10) / 10,
        capacityKw: asset.capacityKw,
        renewable,
        ok,
      });
    }
  }
  return rows;
}

export default function DashboardRealTimeGeneration() {
  const { agents } = useRegistration();
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [refreshSeq, setRefreshSeq] = useState(0);

  const allRows = useMemo(() => buildRows(agents, refreshSeq), [agents, refreshSeq]);

  const filteredRows = useMemo(() => {
    const byAgent =
      agentFilter === 'all' ? allRows : allRows.filter((r) => String(r.agentId) === agentFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byAgent;
    return byAgent.filter(
      (r) =>
        r.meterNo.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q) ||
        r.agentName.toLowerCase().includes(q)
    );
  }, [allRows, agentFilter, search]);

  const totals = useMemo(() => {
    const sumKw = filteredRows.reduce((s, r) => s + r.kw, 0);
    const meters = filteredRows.length;
    const agentIds = new Set(filteredRows.map((r) => r.agentId));
    const capSum = filteredRows.reduce((s, r) => s + r.capacityKw, 0);
    const avgUtil = capSum > 0 ? (sumKw / capSum) * 100 : 0;
    return {
      sumKw: Math.round(sumKw * 10) / 10,
      meters,
      agents: agentIds.size,
      avgUtil: Math.round(avgUtil * 10) / 10,
    };
  }, [filteredRows]);

  const agentSummaries = useMemo(() => {
    const map = new Map<
      number,
      { name: string; sumKw: number; meters: number; cap: number }
    >();
    for (const r of filteredRows) {
      const cur = map.get(r.agentId) ?? { name: r.agentName, sumKw: 0, meters: 0, cap: 0 };
      cur.sumKw += r.kw;
      cur.meters += 1;
      cur.cap += r.capacityKw;
      map.set(r.agentId, cur);
    }
    return agents
      .map((a) => {
        const s = map.get(a.id);
        if (!s) return null;
        const util = s.cap > 0 ? (s.sumKw / s.cap) * 100 : 0;
        return {
          id: a.id,
          name: s.name,
          sumKw: Math.round(s.sumKw * 10) / 10,
          meters: s.meters,
          cap: s.cap,
          util: Math.round(util * 10) / 10,
        };
      })
      .filter(Boolean) as { id: number; name: string; sumKw: number; meters: number; cap: number; util: number }[];
  }, [agents, filteredRows]);

  const chartData = useMemo(() => {
    const current = totals.sumKw || 0;
    const points = 7;
    return Array.from({ length: points }, (_, i) => {
      const minsAgo = (points - 1 - i) * 2;
      const d = new Date(lastUpdated.getTime() - minsAgo * 60_000);
      const lift = 0.82 + (i / (points - 1 || 1)) * 0.18;
      const wobble = 0.96 + hashToUnit(`trend:${i}`, refreshSeq) * 0.08;
      const total = Math.max(0, Math.round(current * lift * wobble * 10) / 10);
      return { label: formatClock(d), total };
    });
  }, [lastUpdated, refreshSeq, totals.sumKw]);

  const onRefresh = () => {
    setLastUpdated(new Date());
    setRefreshSeq((n) => n + 1);
  };

  const trendOption = useMemo<EChartsOption>(
    () => ({
      animation: false,
      grid: { top: 24, right: 16, bottom: 24, left: 40 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const first = list[0] as { axisValueLabel?: string } | undefined;
          const p = list[0] as { value?: number | [string, number] } | undefined;
          const value = Array.isArray(p?.value) ? Number(p?.value[1] ?? 0) : Number(p?.value ?? 0);
          return `${first?.axisValueLabel ?? ''}<br/>總發電：${value.toFixed(1)} kW`;
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartData.map((d) => d.label),
        axisLabel: { color: '#64748b', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 12 },
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      },
      series: [
        {
          name: '總發電',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#0ea5e9' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(56,189,248,0.8)' },
                { offset: 1, color: 'rgba(56,189,248,0.08)' },
              ],
            },
          },
          data: chartData.map((d) => Number(d.total.toFixed(1))),
        },
      ],
    }),
    [chartData]
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">2.3 即時發電量監控</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">再生能源即時發電儀表板</h1>
              <p className="mt-2 text-sm text-slate-600">
                即時接收電表發電量資料，顯示個別發電端表號與代理人聚合發電情況。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={onRefresh}>
                立即更新
              </Button>
              <p className="text-sm text-slate-500">上次更新：{formatClock(lastUpdated)}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">累計發電(即時)</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totals.sumKw} kW</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">監控表號數</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totals.meters}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">代理人數</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totals.agents}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">平均利用率</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totals.avgUtil}%</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">過去 12 分鐘總發電趨勢</p>
          <div className="mt-6 h-72 w-full min-w-0">
            <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-slate-500">監控篩選</p>
              <div className="flex flex-wrap gap-3">
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="代理人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部代理人</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="max-w-md"
                  placeholder="搜尋表號 / 案場 / 代理人"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {agentSummaries.map((s) => (
              <div key={s.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{s.name}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{s.sumKw} kW</p>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    <p>發電表數：{s.meters}</p>
                    <p>裝置容量：{s.cap} kW</p>
                    <p>利用率： {s.util}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">個別電表監控</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">表號即時發電狀態</h2>
            </div>
            <div className="rounded-3xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
              共 {filteredRows.length} 筆資料
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3">代理人</th>
                  <th className="px-4 py-3">表號 / 案場</th>
                  <th className="px-4 py-3">即時發電</th>
                  <th className="px-4 py-3">容量</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="px-4 py-3">更新時間</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredRows.map((r) => (
                  <tr key={`${r.agentId}-${r.meterNo}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-700">{r.agentName}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900">{r.meterNo}</p>
                      <p className="text-slate-500">{r.siteName}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-900">
                      {r.kw} kW
                      <div className="mt-1 text-xs text-slate-500">{r.renewable}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{r.capacityKw} kW</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {r.ok ? '正常' : '異常'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500">{formatClock(lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
