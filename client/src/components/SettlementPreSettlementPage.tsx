import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

type HourRow = {
  hour: number;
  generationPlan: number;
  generationActual: number;
  loadPlan: number;
  loadActual: number;
  storagePlan: number;
  storageActual: number;
};

function buildHourlyRows(): HourRow[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const baseGen = hour >= 6 && hour <= 17 ? 55 + Math.sin((hour - 6) / 11 * Math.PI) * 95 : 18;
    const generationPlan = Number(baseGen.toFixed(1));
    const generationActual = Number((generationPlan * (0.93 + ((hour % 5) - 2) * 0.018)).toFixed(1));

    const baseLoad = 72 + Math.cos((hour - 13) / 11 * Math.PI) * 26 + (hour >= 18 && hour <= 22 ? 24 : 0);
    const loadPlan = Number(baseLoad.toFixed(1));
    const loadActual = Number((loadPlan * (0.95 + ((hour % 4) - 1) * 0.02)).toFixed(1));

    const storagePlan = Number((hour >= 11 && hour <= 14 ? 20 + (hour - 11) * 4 : hour >= 18 && hour <= 20 ? -28 + (hour - 18) * 2 : 0).toFixed(1));
    const storageActual = Number((storagePlan * (0.88 + ((hour % 3) - 1) * 0.06)).toFixed(1));

    return {
      hour,
      generationPlan,
      generationActual,
      loadPlan,
      loadActual,
      storagePlan,
      storageActual,
    };
  });
}

function buildSeriesChartOption(title: string, rows: HourRow[], planKey: keyof HourRow, actualKey: keyof HourRow, unit: string): EChartsOption {
  return {
    animation: false,
    title: { text: title, left: 8, top: 4, textStyle: { fontSize: 13, fontWeight: 700, color: '#0f172a' } },
    grid: { top: 34, right: 18, bottom: 46, left: 52, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { top: 8, right: 10, textStyle: { fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: rows.map((r) => `${String(r.hour).padStart(2, '0')}:00`),
      axisLabel: { fontSize: 10, interval: 3 },
    },
    yAxis: { type: 'value', name: unit, axisLabel: { fontSize: 10 } },
    series: [
      {
        name: '規劃量',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { type: 'dashed', width: 2, color: '#334155' },
        itemStyle: { color: '#334155' },
        data: rows.map((r) => Number(r[planKey])),
      },
      {
        name: '即時量測',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.4, color: '#2563eb' },
        itemStyle: { color: '#2563eb' },
        data: rows.map((r) => Number(r[actualKey])),
      },
    ],
  };
}

export default function SettlementPreSettlementPage() {
  const hourlyRows = useMemo(() => buildHourlyRows(), []);

  const allocationRows = useMemo(
    () =>
      hourlyRows.map((row) => {
        const allocated = Math.min(row.generationActual + Math.max(row.storageActual, 0), row.loadPlan);
        const transferred = Math.max(0, Math.min(allocated, row.loadActual));
        return {
          hour: row.hour,
          allocated: Number(allocated.toFixed(1)),
          transferred: Number(transferred.toFixed(1)),
          diff: Number((transferred - row.loadActual).toFixed(1)),
        };
      }),
    [hourlyRows]
  );

  const storageSettlementRows = useMemo(
    () =>
      hourlyRows
        .filter((r) => r.storagePlan !== 0 || r.storageActual !== 0)
        .map((r) => ({
          hour: r.hour,
          plan: r.storagePlan,
          actual: r.storageActual,
          delta: Number((r.storageActual - r.storagePlan).toFixed(1)),
          consistent: Math.abs(r.storageActual - r.storagePlan) <= 3.5,
        })),
    [hourlyRows]
  );

  const sankeyOption = useMemo<EChartsOption>(
    () => ({
      animation: false,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'sankey',
          left: 6,
          right: 6,
          top: 8,
          bottom: 8,
          emphasis: { focus: 'adjacency' },
          nodeWidth: 20,
          lineStyle: { color: 'source', curveness: 0.45, opacity: 0.6 },
          label: { color: '#0f172a', fontSize: 11, fontWeight: 600 },
          data: [
            { name: '11:00 發電端 (90度)' },
            { name: '12:00 發電端 (100度)' },
            { name: '13:00 發電端 (120度)' },
            { name: '14:00 發電端 (90度)' },
            { name: '合約履行量 (40度)' },
            { name: '儲能調節帳戶 (360度)' },
            { name: '18:00 用戶端 (130度)' },
            { name: '19:00 用戶端 (120度)' },
            { name: '20:00 用戶端 (90度)' },
            { name: '儲能餘額 (20度)' },
          ],
          links: [
            { source: '11:00 發電端 (90度)', target: '合約履行量 (40度)', value: 10 },
            { source: '11:00 發電端 (90度)', target: '儲能調節帳戶 (360度)', value: 80 },
            { source: '12:00 發電端 (100度)', target: '合約履行量 (40度)', value: 10 },
            { source: '12:00 發電端 (100度)', target: '儲能調節帳戶 (360度)', value: 90 },
            { source: '13:00 發電端 (120度)', target: '合約履行量 (40度)', value: 10 },
            { source: '13:00 發電端 (120度)', target: '儲能調節帳戶 (360度)', value: 110 },
            { source: '14:00 發電端 (90度)', target: '合約履行量 (40度)', value: 10 },
            { source: '14:00 發電端 (90度)', target: '儲能調節帳戶 (360度)', value: 80 },
            { source: '合約履行量 (40度)', target: '18:00 用戶端 (130度)', value: 40 },
            { source: '儲能調節帳戶 (360度)', target: '18:00 用戶端 (130度)', value: 90 },
            { source: '儲能調節帳戶 (360度)', target: '19:00 用戶端 (120度)', value: 120 },
            { source: '儲能調節帳戶 (360度)', target: '20:00 用戶端 (90度)', value: 90 },
            { source: '儲能調節帳戶 (360度)', target: '儲能餘額 (20度)', value: 20 },
          ],
        },
      ],
    }),
    []
  );

  const genChartOption = useMemo(
    () => buildSeriesChartOption('發電量：規劃 vs 即時', hourlyRows, 'generationPlan', 'generationActual', 'kWh'),
    [hourlyRows]
  );
  const loadChartOption = useMemo(
    () => buildSeriesChartOption('用電量：規劃 vs 即時', hourlyRows, 'loadPlan', 'loadActual', 'kWh'),
    [hourlyRows]
  );
  const storageChartOption = useMemo(
    () => buildSeriesChartOption('儲能量：規劃 vs 即時', hourlyRows, 'storagePlan', 'storageActual', 'kWh'),
    [hourlyRows]
  );

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">資料來源：AMI(量測)</span>
          <span className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">資料來源：M表(量測)</span>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">資料來源：計畫量</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">4.1 預結算 - 桑基匹配圖</h3>
        <p className="mt-1 text-xs font-semibold text-slate-600">以單日每小時加總量，呈現發電端、合約履行量、用戶端匹配關係。</p>
        <div className="mt-4 h-[360px] rounded-xl border border-slate-200 bg-slate-50 p-2">
          <ReactECharts option={sankeyOption} style={{ height: '100%', width: '100%' }} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-bold">時段</th>
                <th className="px-3 py-2 text-right font-bold">發電端(kWh)</th>
                <th className="px-3 py-2 text-right font-bold">合約履行(kWh)</th>
                <th className="px-3 py-2 text-right font-bold">用戶匹配(kWh)</th>
              </tr>
            </thead>
            <tbody>
              {[11, 12, 13, 14].map((h) => {
                const row = hourlyRows[h];
                const contract = 10;
                const matched = Math.min(row.generationActual, row.loadActual);
                return (
                  <tr key={`sankey-row-${h}`} className="border-t border-slate-200">
                    <td className="px-3 py-2">{`${String(h).padStart(2, '0')}:00`}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.generationActual.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{contract.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{matched.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">預結算分配量 / 轉移成功量</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-[260px] rounded-xl border border-slate-200 bg-slate-50 p-2"><ReactECharts option={genChartOption} style={{ height: '100%' }} /></div>
          <div className="h-[260px] rounded-xl border border-slate-200 bg-slate-50 p-2"><ReactECharts option={loadChartOption} style={{ height: '100%' }} /></div>
          <div className="h-[260px] rounded-xl border border-slate-200 bg-slate-50 p-2"><ReactECharts option={storageChartOption} style={{ height: '100%' }} /></div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-bold">時間</th>
                <th className="px-3 py-2 text-right font-bold">預結算分配量(kWh)</th>
                <th className="px-3 py-2 text-right font-bold">轉移成功量(kWh)</th>
                <th className="px-3 py-2 text-right font-bold">與用電即時差異(kWh)</th>
              </tr>
            </thead>
            <tbody>
              {allocationRows.map((r) => (
                <tr key={`alloc-${r.hour}`} className="border-t border-slate-200">
                  <td className="px-3 py-2">{`${String(r.hour).padStart(2, '0')}:00`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.allocated.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.transferred.toFixed(1)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{r.diff.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">儲能預結算一致性（計畫量 vs 實際運轉）</h3>
        <p className="mt-1 text-xs font-semibold text-slate-600">計畫量對應申報計畫數值；比對實際運轉是否一致。</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-bold">時間</th>
                <th className="px-3 py-2 text-right font-bold">計畫量(kWh)</th>
                <th className="px-3 py-2 text-right font-bold">實際運轉(kWh)</th>
                <th className="px-3 py-2 text-right font-bold">差異(kWh)</th>
                <th className="px-3 py-2 text-center font-bold">一致性</th>
              </tr>
            </thead>
            <tbody>
              {storageSettlementRows.map((r) => (
                <tr key={`storage-settlement-${r.hour}`} className="border-t border-slate-200">
                  <td className="px-3 py-2">{`${String(r.hour).padStart(2, '0')}:00`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.plan.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.actual.toFixed(1)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.delta === 0 ? 'text-slate-700' : r.delta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{r.delta.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.consistent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.consistent ? '一致' : '需調整'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
