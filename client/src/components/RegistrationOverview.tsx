import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegistration } from '@/contexts/RegistrationContext';
import type { AppInfo } from '@/types/index';
import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';

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
  const { startNewRegistration, applications, upsertApplication, deleteApplication, loadApplicationToForm } = useRegistration();
  const [searchField, setSearchField] = useState<RegistrationSearchField>('name');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ agentName: string; taxId: string; type: string; status: string; date: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RegistrationItem | null>(null);

  const rows = useMemo<RegistrationItem[]>(() => {
    return applications.map((a: AppInfo) => ({
      id: a.appId,
      name: a.agentName,
      taxId: a.taxId,
      type: a.type,
      status: a.status,
      updatedAt: a.date,
    }));
  }, [applications]);

  const filteredRows = useMemo(() => {
    const q = (searchKeyword ?? '').trim();
    if (!q) return rows;
    return rows.filter((row: RegistrationItem) => {
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
              onValueChange={(v: string) => setSearchField(v as RegistrationSearchField)}
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
                onChange={(e: any) => setSearchKeyword(e.target.value)}
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
            filteredRows.map((row: RegistrationItem, index: number) => (
              <div
                key={`${row.id}-${index}`}
                className="border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition-all rounded-xl p-4 md:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h4 className="text-lg font-bold text-slate-800">{row.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">{row.id}</span>
                    {editingAppId !== row.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAppId(row.id);
                            setDraft({
                              agentName: row.name,
                              taxId: row.taxId,
                              type: row.type,
                              status: row.status,
                              date: row.updatedAt,
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-blue-700 hover:bg-blue-50 font-bold text-xs transition"
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-bold text-xs transition"
                        >
                          刪除
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingAppId === row.id && draft ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm mb-4">
                    <Input value={draft.agentName} onChange={(e: any) => setDraft((p: any) => (p ? { ...p, agentName: e.target.value } : p))} />
                    <Input value={draft.taxId} onChange={(e: any) => setDraft((p: any) => (p ? { ...p, taxId: e.target.value } : p))} />
                    <Input value={draft.type} onChange={(e: any) => setDraft((p: any) => (p ? { ...p, type: e.target.value } : p))} />
                    <select
                      value={draft.status}
                      onChange={(e: any) => setDraft((p: any) => (p ? { ...p, status: e.target.value } : p))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700 font-bold outline-none"
                    >
                      <option value="審核中">審核中</option>
                      <option value="書審通過">書審通過</option>
                      <option value="已完成">已完成</option>
                    </select>
                    <Input type="date" value={draft.date} onChange={(e: any) => setDraft((p: any) => (p ? { ...p, date: e.target.value } : p))} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                    <div><span className="text-slate-500">統編：</span><span className="font-bold text-slate-700">{row.taxId}</span></div>
                    <div><span className="text-slate-500">類型：</span><span className="font-bold text-slate-700">{row.type}</span></div>
                    <div><span className="text-slate-500">狀態：</span><span className="font-bold text-blue-700">{row.status}</span></div>
                    <div className="lg:col-span-2"><span className="text-slate-500">更新日期：</span><span className="font-bold text-slate-700">{row.updatedAt}</span></div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end gap-2">
                  {editingAppId === row.id && draft ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAppId(null);
                          setDraft(null);
                        }}
                        className="px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 font-bold text-sm transition"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          upsertApplication({
                            appId: row.id,
                            agentName: draft.agentName,
                            taxId: draft.taxId,
                            type: draft.type,
                            status: draft.status,
                            date: draft.date,
                          });
                          setEditingAppId(null);
                          setDraft(null);
                        }}
                        className="px-3 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 font-bold text-sm transition"
                      >
                        儲存
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => loadApplicationToForm(row.id)}
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-sm transition"
                      >
                        進入流程
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <i className="fas fa-trash-alt" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800">確認刪除申請單</h4>
                <p className="mt-2 text-sm text-slate-500">
                  你即將刪除 <span className="font-bold text-slate-700">{deleteTarget.name}</span>（{deleteTarget.id}）。
                </p>
                <p className="text-sm text-slate-500">此操作將同步更新總覽資料。</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = deleteTarget;
                  deleteApplication(target.id);
                  setDeleteTarget(null);
                  void Swal.fire({
                    icon: 'success',
                    title: '成功刪除',
                    text: `已刪除「${target.name}」申請單（${target.id}）。`,
                    confirmButtonText: '確定',
                    confirmButtonColor: '#2563eb',
                  });
                }}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
