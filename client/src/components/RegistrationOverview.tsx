import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AGENT_OVERVIEW_ROW_META } from '@/data/agentAggregation';
import { useRegistration } from '@/contexts/RegistrationContext';
import { useMemo, useState } from 'react';

type RegistrationSearchField = 'name' | 'taxId' | 'type';

interface RegistrationItem {
  id: string;
  name: string;
  taxId: string;
  type: string;
  status: string;
  updatedAt: string;
}

function matchesKeyword(haystack: string | undefined | null, needle: string | undefined | null) {
  const n = (needle ?? '').trim();
  if (!n) return true;
  return (haystack ?? '').toLowerCase().includes(n.toLowerCase());
}

export default function RegistrationOverview() {
  const { appInfo, startNewRegistration, agents, updateAgent, deleteAgent } = useRegistration();
  const [searchField, setSearchField] = useState<RegistrationSearchField>('name');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedAgentIds, setExpandedAgentIds] = useState<Set<number>>(() => new Set());
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
  const [agentDraft, setAgentDraft] = useState<{ name: string; taxId: string; registrationType: string } | null>(null);

  const rows = useMemo<RegistrationItem[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const fromSharedAgents: RegistrationItem[] = agents.map((agent) => {
      const meta = AGENT_OVERVIEW_ROW_META[agent.id] ?? { status: '已完成', updatedAt: today };
      return {
        id: `APP-AGENT-${agent.id}`,
        name: agent.name,
        taxId: agent.taxId,
        type: agent.registrationType,
        status: meta.status,
        updatedAt: meta.updatedAt,
      };
    });
    return [
      {
        id: appInfo.appId ?? `APP-${today.replace(/-/g, '')}`,
        name: appInfo.agentName || '（尚未填寫）',
        taxId: appInfo.taxId || '（尚未填寫）',
        type: appInfo.type || '註冊登記合格交易者',
        status: appInfo.status || '草稿',
        updatedAt: appInfo.date ?? today,
      },
      ...fromSharedAgents,
    ];
  }, [appInfo]);

  const filteredRows = useMemo(() => {
    const q = (searchKeyword ?? '').trim();
    if (!q) return rows;
    return rows.filter((row) => {
      const value =
        searchField === 'name' ? row.name : searchField === 'taxId' ? row.taxId : row.type;
      return matchesKeyword(value, q);
    });
  }, [rows, searchField, searchKeyword]);

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-800">1.1 註冊申請總覽</h3>
            <p className="text-slate-500 mt-2">先從總覽管理申請單，再按「新增註冊」進入 1-2-3 流程。</p>
          </div>
          <button
            onClick={startNewRegistration}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition-all hover:scale-[1.02]"
          >
            <i className="fas fa-plus mr-2" />
            新增註冊
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap mb-6">
          <div className="space-y-1.5 min-w-[200px]">
            <label className="text-sm font-bold text-slate-600">搜尋欄位</label>
            <Select
              value={searchField}
              onValueChange={(v) => setSearchField(v as RegistrationSearchField)}
            >
              <SelectTrigger className="w-full sm:w-[220px] border-slate-200 bg-white">
                <SelectValue placeholder="選擇欄位" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">申請名稱</SelectItem>
                <SelectItem value="taxId">統一編號</SelectItem>
                <SelectItem value="type">註冊類型</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-sm font-bold text-slate-600">關鍵字</label>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <Input
                value={searchKeyword ?? ''}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="輸入關鍵字篩選列表…"
                className="pl-9 border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-slate-500">
              沒有符合條件的申請，請調整關鍵字或搜尋欄位。
            </div>
          ) : (
            filteredRows.map((row, index) => (
            <div
              key={`${row.id}-${index}`}
              className="border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition-all rounded-xl p-4 md:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h4 className="text-lg font-bold text-slate-800">{row.name}</h4>
                <span className="text-xs font-mono text-slate-500">{row.id}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                <div><span className="text-slate-500">統編：</span><span className="font-bold text-slate-700">{row.taxId}</span></div>
                <div><span className="text-slate-500">類型：</span><span className="font-bold text-slate-700">{row.type}</span></div>
                <div><span className="text-slate-500">狀態：</span><span className="font-bold text-blue-700">{row.status}</span></div>
                <div className="lg:col-span-2"><span className="text-slate-500">更新日期：</span><span className="font-bold text-slate-700">{row.updatedAt}</span></div>
              </div>
            </div>
            ))
          )}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-8">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h4 className="text-xl font-black text-slate-800">代理人資料（與 2.1 同步）</h4>
              <p className="text-sm text-slate-500 mt-1">可展開查看資源，並在此直接編輯 / 刪除。</p>
            </div>
          </div>

          <div className="space-y-3">
            {agents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-slate-500">
                目前沒有代理人資料
              </div>
            ) : (
              agents.map((agent) => {
                const isExpanded = expandedAgentIds.has(agent.id);
                const isEditing = editingAgentId === agent.id;
                return (
                  <div key={`agent-${agent.id}`} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedAgentIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(agent.id)) next.delete(agent.id);
                            else next.add(agent.id);
                            return next;
                          });
                        }}
                        className="flex-1 text-left"
                        title="展開/收合"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-lg font-black text-slate-800">{agent.name}</p>
                            <p className="text-sm text-slate-500 mt-1">
                              統編：<span className="font-mono font-bold text-slate-700">{agent.taxId}</span>
                              <span className="mx-2 text-slate-300">|</span>
                              註冊類型：<span className="font-bold text-slate-700">{agent.registrationType}</span>
                            </p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">總聚合容量</p>
                            <p className="text-lg font-black text-blue-700">{agent.genCap + agent.loadCap + agent.storageCap} kW</p>
                          </div>
                        </div>
                      </button>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAgentId(agent.id);
                            setAgentDraft({ name: agent.name, taxId: agent.taxId, registrationType: agent.registrationType });
                            setExpandedAgentIds((prev) => {
                              const next = new Set(prev);
                              next.add(agent.id);
                              return next;
                            });
                          }}
                          className="px-3 py-2 rounded-lg text-blue-700 hover:bg-blue-50 font-bold text-sm transition"
                          title="編輯"
                        >
                          <i className="fas fa-edit mr-2" />
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAgent(agent.id)}
                          className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-bold text-sm transition"
                          title="刪除"
                        >
                          <i className="fas fa-trash-alt mr-2" />
                          刪除
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-slate-50/40">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <p className="text-sm font-black text-slate-700">資源概覽</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAgentId(agent.id);
                                setAgentDraft({ name: agent.name, taxId: agent.taxId, registrationType: agent.registrationType });
                              }}
                              className="px-3 py-2 rounded-lg text-blue-700 hover:bg-blue-50 font-bold text-sm transition"
                              title="編輯"
                            >
                              <i className="fas fa-edit mr-2" />
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAgent(agent.id)}
                              className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-bold text-sm transition"
                              title="刪除"
                            >
                              <i className="fas fa-trash-alt mr-2" />
                              刪除
                            </button>
                          </div>
                        </div>

                        {isEditing && agentDraft ? (
                          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-xs font-bold text-slate-500">申請名稱</label>
                                <Input
                                  value={agentDraft.name}
                                  onChange={(e) => setAgentDraft((p) => (p ? { ...p, name: e.target.value } : p))}
                                  className="mt-1 border-slate-200 bg-white"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500">統一編號</label>
                                <Input
                                  value={agentDraft.taxId}
                                  onChange={(e) => setAgentDraft((p) => (p ? { ...p, taxId: e.target.value } : p))}
                                  className="mt-1 border-slate-200 bg-white font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500">註冊類型</label>
                                <Input
                                  value={agentDraft.registrationType}
                                  onChange={(e) => setAgentDraft((p) => (p ? { ...p, registrationType: e.target.value } : p))}
                                  className="mt-1 border-slate-200 bg-white"
                                />
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAgentId(null);
                                  setAgentDraft(null);
                                }}
                                className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateAgent(agent.id, {
                                    name: agentDraft.name,
                                    taxId: agentDraft.taxId,
                                    registrationType: agentDraft.registrationType,
                                  });
                                  setEditingAgentId(null);
                                  setAgentDraft(null);
                                }}
                                className="px-5 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
                              >
                                儲存
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <p className="font-black text-yellow-700 mb-2"><i className="fas fa-sun mr-2" />Account A 發電資產</p>
                            {agent.genList.length === 0 ? (
                              <p className="text-sm text-slate-400">無</p>
                            ) : (
                              <ul className="space-y-2 text-sm">
                                {agent.genList.map((a) => (
                                  <li key={a.id} className="rounded-lg bg-yellow-50/60 border border-yellow-100 p-2">
                                    <p className="font-bold text-slate-800">{a.name}</p>
                                    <p className="text-xs text-slate-500 font-mono">{a.no}</p>
                                    <p className="text-xs text-slate-500">{a.capacityKw} kW</p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <p className="font-black text-red-700 mb-2"><i className="fas fa-building mr-2" />Account B 用電資產</p>
                            {agent.loadList.length === 0 ? (
                              <p className="text-sm text-slate-400">無</p>
                            ) : (
                              <ul className="space-y-2 text-sm">
                                {agent.loadList.map((a) => (
                                  <li key={a.id} className="rounded-lg bg-red-50/60 border border-red-100 p-2">
                                    <p className="font-bold text-slate-800">{a.name}</p>
                                    <p className="text-xs text-slate-500 font-mono">{a.no}</p>
                                    <p className="text-xs text-slate-500">{a.capacityKw} kW</p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <p className="font-black text-blue-700 mb-2"><i className="fas fa-battery-full mr-2" />Account C 儲能調節</p>
                            {agent.storageList.length === 0 ? (
                              <p className="text-sm text-slate-400">無</p>
                            ) : (
                              <ul className="space-y-2 text-sm">
                                {agent.storageList.map((a) => (
                                  <li key={a.id} className="rounded-lg bg-blue-50/60 border border-blue-100 p-2">
                                    <p className="font-bold text-slate-800">{a.name}</p>
                                    <p className="text-xs text-slate-500 font-mono">{a.no}</p>
                                    <p className="text-xs text-slate-500">{a.capacityKw} kW</p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
