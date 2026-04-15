import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const mockHistory: RegistrationItem[] = [
  { id: 'APP-24092101', name: '台電綠能聚合商', taxId: '87654321', type: '註冊登記合格交易者', status: '已完成', updatedAt: '2026-04-03' },
  { id: 'APP-24092102', name: '永續綠能科技', taxId: '12345678', type: '資訊變更', status: '審核中', updatedAt: '2026-04-07' },
];

function matchesKeyword(haystack: string, needle: string) {
  const n = needle.trim();
  if (!n) return true;
  return haystack.toLowerCase().includes(n.toLowerCase());
}

export default function RegistrationOverview() {
  const { appInfo, startNewRegistration } = useRegistration();
  const [searchField, setSearchField] = useState<RegistrationSearchField>('name');
  const [searchKeyword, setSearchKeyword] = useState('');

  const rows = useMemo<RegistrationItem[]>(
    () => [
      {
        id: appInfo.appId,
        name: appInfo.agentName || '（尚未填寫）',
        taxId: appInfo.taxId || '（尚未填寫）',
        type: appInfo.type || '註冊登記合格交易者',
        status: appInfo.status || '草稿',
        updatedAt: appInfo.date,
      },
      ...mockHistory,
    ],
    [appInfo]
  );

  const filteredRows = useMemo(() => {
    const q = searchKeyword.trim();
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
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.targetValue)}
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
      </div>
    </div>
  );
}
