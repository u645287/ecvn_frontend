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
import { GripVertical } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';
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

/** 將 fromId 移到 toId 的位置（插在 toId 之前） */
function reorderIds(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return ids;
  const fromIdx = ids.indexOf(fromId);
  const toIdx = ids.indexOf(toId);
  if (fromIdx === -1 || toIdx === -1) return ids;
  const next = [...ids];
  next.splice(fromIdx, 1);
  const insertAt = next.indexOf(toId);
  next.splice(insertAt, 0, fromId);
  return next;
}

export default function RegistrationOverview() {
  const { startNewRegistration, applications, deleteApplication, loadApplicationToForm } = useRegistration();
  const [searchField, setSearchField] = useState<RegistrationSearchField>('name');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RegistrationItem | null>(null);
  /** 僅前端顯示順序，不寫回 context */
  const [cardOrderIds, setCardOrderIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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

  const defaultOrderIds = useMemo(() => filteredRows.map((r) => r.id), [filteredRows]);

  const displayOrderIds = useMemo(() => {
    const allowed = new Set(defaultOrderIds);
    if (
      cardOrderIds.length === defaultOrderIds.length &&
      defaultOrderIds.length > 0 &&
      cardOrderIds.every((id) => allowed.has(id))
    ) {
      return cardOrderIds;
    }
    return defaultOrderIds;
  }, [cardOrderIds, defaultOrderIds]);

  const rowById = useMemo(() => new Map(filteredRows.map((r) => [r.id, r])), [filteredRows]);

  const orderedRows = useMemo(
    () => displayOrderIds.map((id) => rowById.get(id)).filter((r): r is RegistrationItem => Boolean(r)),
    [displayOrderIds, rowById],
  );

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-800">註冊申請總覽</h3>
            <p className="text-slate-500 mt-2">
              先從總覽管理申請單，再按「新增註冊」進入 1-2-3 流程。可拖曳整張卡片調整順序（僅畫面效果，不儲存）；按鈕區仍為點擊操作。
            </p>
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)}
                placeholder="輸入關鍵字篩選列表…"
                className="pl-9 border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4" role="list" aria-label="申請單列表">
          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-slate-500">
              沒有符合條件的申請，請調整關鍵字或搜尋欄位。
            </div>
          ) : (
            orderedRows.map((row: RegistrationItem) => (
              <div
                key={row.id}
                role="listitem"
                draggable
                tabIndex={0}
                title="拖曳整張卡片以調整順序"
                aria-label={`${row.name}，拖曳卡片可調整順序，上下鍵可與鄰近項目對調`}
                onDragStart={(e) => {
                  const t = e.target as HTMLElement | null;
                  if (t?.closest('button')) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData('text/plain', row.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingId(row.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropTargetId(null);
                }}
                onDragOver={(e) => {
                  if (!draggingId || draggingId === row.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropTargetId(row.id);
                }}
                onDragLeave={() => setDropTargetId((cur) => (cur === row.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = e.dataTransfer.getData('text/plain');
                  setDropTargetId(null);
                  setDraggingId(null);
                  if (!fromId || fromId === row.id) return;
                  setCardOrderIds((prev) => {
                    const allowed = new Set(defaultOrderIds);
                    const base =
                      prev.length === defaultOrderIds.length && prev.every((id) => allowed.has(id))
                        ? prev
                        : defaultOrderIds;
                    return reorderIds(base, fromId, row.id);
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                  e.preventDefault();
                  setCardOrderIds((prev) => {
                    const allowed = new Set(defaultOrderIds);
                    const base =
                      prev.length === defaultOrderIds.length && prev.every((id) => allowed.has(id))
                        ? prev
                        : defaultOrderIds;
                    const idx = base.indexOf(row.id);
                    if (idx === -1) return prev;
                    const j = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
                    if (j < 0 || j >= base.length) return prev;
                    const next = [...base];
                    [next[idx], next[j]] = [next[j], next[idx]];
                    return next;
                  });
                }}
                className={`border bg-slate-50/60 hover:bg-white transition-all rounded-xl p-4 md:p-5 cursor-grab active:cursor-grabbing select-none ${
                  dropTargetId === row.id && draggingId && draggingId !== row.id
                    ? 'border-blue-400 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-blue-300'
                } ${draggingId === row.id ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <GripVertical className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
                    <h4 className="text-lg font-bold text-slate-800 truncate">{row.name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">{row.id}</span>
                    <button
                      type="button"
                      draggable={false}
                      onClick={() => loadApplicationToForm(row.id)}
                      className="px-2.5 py-1.5 rounded-lg text-blue-700 hover:bg-blue-50 font-bold text-xs transition cursor-pointer"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      draggable={false}
                      onClick={() => setDeleteTarget(row)}
                      className="px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-bold text-xs transition cursor-pointer"
                    >
                      刪除
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">統編：</span>
                    <span className="font-bold text-slate-700">{row.taxId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">類型：</span>
                    <span className="font-bold text-slate-700">{row.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">狀態：</span>
                    <span className="font-bold text-blue-700">{row.status}</span>
                  </div>
                  <div className="lg:col-span-2">
                    <span className="text-slate-500">更新日期：</span>
                    <span className="font-bold text-slate-700">{row.updatedAt}</span>
                  </div>
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
