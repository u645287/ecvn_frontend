import { useState } from 'react';
import { useRegistration, type PlanSection, type AppMainView } from '@/contexts/RegistrationContext';

// 定義導覽資料結構
interface SubItem {
  id: string;
  label: string;
  view?: AppMainView;
  /** 申報計畫單頁內錨點（僅 view 為 declaration-plan 時使用） */
  section?: PlanSection;
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
    label: '1. 註冊作業',
    subItems: [
      { id: 'reg-1-1', label: '1.1 註冊申請', view: 'registration' },
      { id: 'reg-1-2', label: '1.2 能力測試' },
      { id: 'reg-1-3', label: '1.3 保證金' },
      { id: 'reg-1-4', label: '1.4 上線' },
    ],
  },
  {
    id: 'dashboard',
    icon: 'fas fa-gauge-high',
    label: '2. 儀錶板',
    subItems: [
      { id: 'dash-2-1', label: '2.1 代理人資源聚合管理', view: 'dashboard-agent-aggregation' },
      { id: 'dash-2-2', label: '2.2 通訊資料' },
      { id: 'dash-2-3', label: '2.3 即時發電量監控' },
      { id: 'dash-2-4', label: '2.4 MVRN 分配' },
    ],
  },
  {
    id: 'bidding',
    icon: 'fas fa-gavel',
    label: '3. 申報計畫',
    subItems: [
      { id: 'bid-3-1', label: '3.1 總量', view: 'declaration-plan', section: 'total' },
      { id: 'bid-3-2', label: '3.2 再生能源預測', view: 'declaration-plan', section: 'renewable' },
      { id: 'bid-3-3', label: '3.3 負載預測', view: 'declaration-plan', section: 'load' },
      { id: 'bid-3-4', label: '3.4 儲能計畫', view: 'declaration-plan', section: 'storage' },
    ],
  },
  {
    id: 'settlement',
    icon: 'fas fa-file-invoice-dollar',
    label: '4. 結算作業',
    subItems: [
      { id: 'set-4-1', label: '4.1 預結算' },
      { id: 'set-4-2', label: '4.2 月結算' },
    ],
  },
  {
    id: 'monitoring',
    icon: 'fas fa-shield-alt',
    label: '5. 監管作業',
    subItems: [
      { id: 'mon-5-1', label: '5.1 市場流程監控' },
      { id: 'mon-5-2', label: '5.2 市場監控儀表板' },
    ],
  },
  {
    id: 'others',
    icon: 'fas fa-cog',
    label: '6. 其他作業',
    subItems: [
      { id: 'oth-6-1', label: '6.1 通知' },
      { id: 'oth-6-2', label: '6.2 系統管理' },
      { id: 'oth-6-3', label: '6.3 網站管理' },
    ],
  },
];

export default function Sidebar() {
  const { isSidebarOpen, currentView, setCurrentView, goToRegistrationOverview, goDeclarationPlanSection, declarationPlanSection } =
    useRegistration();
  // 控制哪些模組是展開的
  const [openModules, setOpenModules] = useState<string[]>(['registration', 'dashboard']);

  const toggleModule = (id: string) => {
    setOpenModules((prev: string[]) =>
      prev.includes(id) ? prev.filter((item: string) => item !== id) : [...prev, id]
    );
  };

  return (
    <aside
      className={`${
        isSidebarOpen ? 'w-64' : 'w-20'
      } bg-slate-900 text-white flex flex-col sidebar-transition relative z-20 shadow-xl shrink-0 h-screen ${
        isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'
      }`}
    >
      {/* Logo 區域 */}
      <div className="h-16 flex items-center justify-center border-b border-slate-800">
        <h1
          className={`font-bold tracking-wider text-blue-400 whitespace-nowrap overflow-hidden transition-all ${
            isSidebarOpen ? 'text-xl opacity-100' : 'text-xs opacity-0 w-0'
          }`}
        >
          ECVN小平台
        </h1>
        {!isSidebarOpen && (
          <i className="fas fa-bolt text-blue-400 text-2xl absolute" />
        )}
      </div>

      {/* 導覽選單 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navModules.map((module, moduleIndex) => {
          const isOpen = openModules.includes(module.id);
          
          return (
            <div
              key={module.id}
              className={`space-y-1 sidebar-module ${isSidebarOpen ? 'is-visible' : ''}`}
              style={{ animationDelay: `${moduleIndex * 35}ms` }}
            >
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
                  <i className={`fas fa-chevron-down text-xs transition-transform duration-700 ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* 子項目選單（保留 DOM，讓展開與收起都能平滑轉場） */}
              <div
                className={`ml-8 space-y-1 border-l border-slate-700 pl-2 sidebar-submenu ${
                  isSidebarOpen && isOpen ? 'submenu-open' : 'submenu-closed'
                }`}
              >
                  {module.subItems.map((sub, subIndex) => (
                    <a
                      key={sub.id}
                      href="#"
                      onClick={(e: { preventDefault: () => void }) => {
                        e.preventDefault();
                        if (sub.view === 'registration') {
                          goToRegistrationOverview();
                          return;
                        }
                        if (sub.view === 'declaration-plan' && sub.section) {
                          goDeclarationPlanSection(sub.section);
                          return;
                        }
                        if (sub.view) setCurrentView(sub.view);
                      }}
                      className={`block px-3 py-2 text-sm rounded-md transition-colors sidebar-subitem ${
                        sub.view === currentView &&
                        (sub.view !== 'declaration-plan' || sub.section === declarationPlanSection)
                          ? 'bg-blue-600/20 text-blue-400 font-bold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      style={{ transitionDelay: `${subIndex * 28}ms` }}
                    >
                      {sub.label}
                    </a>
                  ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}