import { useState } from 'react';
import { useRegistration } from '@/contexts/RegistrationContext';

// 定義導覽資料結構
interface SubItem {
  label: string;
  active?: boolean;
}

interface ModuleItem {
  id: string;
  icon: string;
  label: string;
  subItems: SubItem[];
}

const navModules: ModuleItem[] = [
  {
    id: 'registration',
    icon: 'fas fa-user-plus',
    label: '註冊作業',
    subItems: [
      { label: '1.1 註冊申請', active: true },
      { label: '1.2 能力測試' },
      { label: '1.3 保證金' },
      { label: '1.4 上線' },
    ],
  },
  {
    id: 'bidding',
    icon: 'fas fa-gavel',
    label: '競價作業',
    subItems: [
      { label: '2.1 負載預測' },
      { label: '2.2 報價' },
      { label: '2.3 COP' },
      { label: '2.4 公告' },
    ],
  },
  {
    id: 'settlement',
    icon: 'fas fa-file-invoice-dollar',
    label: '結算作業',
    subItems: [
      { label: '3.1 預結算' },
      { label: '3.2 月結算' },
    ],
  },
  {
    id: 'monitoring',
    icon: 'fas fa-shield-alt',
    label: '監管作業',
    subItems: [
      { label: '4.1 市場流程監控' },
      { label: '4.2 市場監控儀表板' },
    ],
  },
  {
    id: 'others',
    icon: 'fas fa-cog',
    label: '其他作業',
    subItems: [
      { label: '5.1 通知' },
      { label: '5.2 系統管理' },
      { label: '5.3 網站管理' },
      { label: '5.4 通訊資料' },
    ],
  },
];

export default function Sidebar() {
  const { isSidebarOpen } = useRegistration();
  // 控制哪些模組是展開的
  const [openModules, setOpenModules] = useState<string[]>(['registration']);

  const toggleModule = (id: string) => {
    setOpenModules((prev: string[]) =>
      prev.includes(id) ? prev.filter((item: string) => item !== id) : [...prev, id]
    );
  };

  return (
    <aside
      className={`${
        isSidebarOpen ? 'w-64' : 'w-20'
      } bg-slate-900 text-white flex flex-col sidebar-transition relative z-20 shadow-xl shrink-0 h-screen`}
    >
      {/* Logo 區域 */}
      <div className="h-16 flex items-center justify-center border-b border-slate-800">
        <h1
          className={`font-bold tracking-wider text-blue-400 whitespace-nowrap overflow-hidden transition-all ${
            isSidebarOpen ? 'text-xl opacity-100' : 'text-xs opacity-0 w-0'
          }`}
        >
          ECVN大平台
        </h1>
        {!isSidebarOpen && (
          <i className="fas fa-bolt text-blue-400 text-2xl absolute" />
        )}
      </div>

      {/* 導覽選單 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navModules.map((module) => {
          const isOpen = openModules.includes(module.id);
          
          return (
            <div key={module.id} className="space-y-1">
              {/* 大模組按鈕 */}
              <button
                onClick={() => isSidebarOpen && toggleModule(module.id)}
                className={`w-full flex items-center px-3 py-3 rounded-lg transition-colors hover:bg-slate-800 text-slate-300 ${
                  !isSidebarOpen ? 'justify-center' : 'justify-between'
                }`}
                title={module.label}
              >
                <div className="flex items-center">
                  <i className={`${module.icon} text-lg w-8 text-center`} />
                  {isSidebarOpen && (
                    <span className="ml-2 font-medium">{module.label}</span>
                  )}
                </div>
                {isSidebarOpen && (
                  <i className={`fas fa-chevron-down text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* 子項目選單 (僅在展開且 Sidebar 開啟時顯示) */}
              {isSidebarOpen && isOpen && (
                <div className="ml-8 space-y-1 border-l border-slate-700 pl-2">
                  {module.subItems.map((sub) => (
                    <a
                      key={sub.label}
                      href="#"
                      onClick={(e: { preventDefault: () => void }) => e.preventDefault()}
                      className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                        sub.active
                          ? 'bg-blue-600/20 text-blue-400 font-bold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {sub.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}