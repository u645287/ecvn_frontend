import { useMemo, useState } from 'react';

interface AssetItem {
  name: string;
  no: string;
}

interface Agent {
  id: number;
  name: string;
  taxId: string;
  genCap: number;
  loadCap: number;
  storageCap: number;
  genMeters: number;
  loadMeters: number;
  bessCount: number;
  genList: AssetItem[];
  loadList: AssetItem[];
  bess: { name: string; meterNo: string };
}

const agents: Agent[] = [
  {
    id: 1, name: '台電綠能聚合商', taxId: '87654321', genCap: 2500, loadCap: 1500, storageCap: 1000, genMeters: 2, loadMeters: 1, bessCount: 1,
    genList: [{ name: '南科一期光電', no: '01-1234-56' }], loadList: [{ name: '新竹總部', no: '05-4321-98' }], bess: { name: '台南大儲', meterNo: 'S-9999-01' },
  },
  {
    id: 2, name: '永續綠能科技', taxId: '12345678', genCap: 4200, loadCap: 2000, storageCap: 2000, genMeters: 5, loadMeters: 1, bessCount: 2,
    genList: [{ name: '雲林光電群', no: '03-1111-22' }], loadList: [{ name: '中壢工廠', no: '06-5555-66' }], bess: { name: '桃園一號', meterNo: 'S-8888-02' },
  },
  {
    id: 3, name: '城市太陽能管理', taxId: '22334455', genCap: 800, loadCap: 800, storageCap: 0, genMeters: 1, loadMeters: 1, bessCount: 0,
    genList: [{ name: '台北公有屋頂', no: '01-3333-44' }], loadList: [{ name: '市府大樓', no: '05-6666-77' }], bess: { name: '無', meterNo: 'N/A' },
  },
  {
    id: 4, name: '全球碳中和顧問', taxId: '99887766', genCap: 1500, loadCap: 1200, storageCap: 500, genMeters: 3, loadMeters: 1, bessCount: 1,
    genList: [{ name: '高雄一廠光電', no: '07-7777-88' }], loadList: [{ name: '數據中心', no: '08-9999-00' }], bess: { name: '高雄微電網', meterNo: 'S-7777-04' },
  },
  {
    id: 5, name: '智慧電網儲能系統', taxId: '55443322', genCap: 3000, loadCap: 2500, storageCap: 3000, genMeters: 1, loadMeters: 1, bessCount: 5,
    genList: [{ name: '大容量離岸風', no: '09-1234-99' }], loadList: [{ name: '竹科晶圓廠', no: '10-2222-11' }], bess: { name: '連鎖儲能', meterNo: 'S-6666-05' },
  },
];

export default function DashboardAgentAggregation() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const maxTotal = useMemo(
    () => Math.max(...agents.map((agent) => agent.genCap + agent.loadCap + agent.storageCap)),
    []
  );

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
              <div key={gen.no} className="p-4 bg-slate-50 rounded-lg border">
                <p className="font-bold text-slate-700">{gen.name}</p>
                <p className="text-xs text-slate-400 mt-1">電號：{gen.no}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-red-600 font-bold border-b-2 border-red-400 pb-2">
              <i className="fas fa-building" />
              <span>Account B 用電資產</span>
            </div>
            {selectedAgent.loadList.map((load) => (
              <div key={load.no} className="p-4 bg-slate-50 rounded-lg border">
                <p className="font-bold text-slate-700">{load.name}</p>
                <p className="text-xs text-slate-400 mt-1">電號：{load.no}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-600 font-bold border-b-2 border-blue-400 pb-2">
              <i className="fas fa-battery-full" />
              <span>Account C 儲能調節</span>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-bold text-blue-800">{selectedAgent.bess.name}</p>
              <p className="text-xs text-blue-600 mt-1 italic">光儲表號：{selectedAgent.bess.meterNo}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">代理人資源聚合管理</h2>
        <p className="text-slate-500 mt-2">點選左側廠商可查看資產細項，右側為聚合規模對比。</p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all overflow-hidden flex"
            >
              <div className="w-2 bg-slate-800" />
              <div className="flex-1 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">{agent.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">統編: {agent.taxId}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-yellow-50 p-2 rounded">
                    <p className="text-[10px] text-yellow-600 font-bold uppercase">發電聚合 (A)</p>
                    <p className="text-sm font-black text-slate-700">{agent.genCap} kW</p>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <p className="text-[10px] text-red-600 font-bold uppercase">用電聚合 (B)</p>
                    <p className="text-sm font-black text-slate-700">{agent.loadCap} kW</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">儲能聚合 (C)</p>
                    <p className="text-sm font-black text-slate-700">{agent.storageCap} kW</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-xs text-slate-500">
                  <span><i className="fas fa-fingerprint mr-1" />發電電號: <b className="text-slate-800">{agent.genMeters}</b></span>
                  <span><i className="fas fa-plug mr-1" />用電電號: <b className="text-slate-800">{agent.loadMeters}</b></span>
                  <span><i className="fas fa-box mr-1" />儲能站: <b className="text-slate-800">{agent.bessCount}</b></span>
                </div>
              </div>
              <div className="w-12 flex items-center justify-center bg-slate-50 text-slate-300">
                <i className="fas fa-chevron-right" />
              </div>
            </button>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-20">
            <h3 className="text-md font-bold text-slate-700 mb-6 flex items-center">
              <i className="fas fa-chart-bar mr-2 text-blue-500" />
              各代理人聚合規模對比 (kW)
            </h3>
            <div className="space-y-4">
              {agents.map((agent) => {
                const total = agent.genCap + agent.loadCap + agent.storageCap;
                return (
                  <div key={`${agent.id}-bar`}>
                    <div className="flex justify-between text-xs mb-1 text-slate-600">
                      <span className="truncate pr-2">{agent.name}</span>
                      <span className="font-bold">{total} kW</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-700"
                        style={{ width: `${(total / maxTotal) * 100}%` }}
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
