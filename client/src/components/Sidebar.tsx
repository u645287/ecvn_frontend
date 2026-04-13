import { useRegistration } from '@/contexts/RegistrationContext';

const navItems = [
  { icon: 'fas fa-home', label: '首頁儀表板', active: false },
  { icon: 'fas fa-user-tie', label: '代理人申請綁定', active: true },
  { icon: 'fas fa-calendar-check', label: '日前排程申報', active: false },
];

export default function Sidebar() {
  const { isSidebarOpen } = useRegistration();

  return (
    <aside
      className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col sidebar-transition relative z-20 shadow-xl shrink-0`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-slate-800">
        <h1
          className={`font-bold tracking-wider text-blue-400 whitespace-nowrap overflow-hidden transition-all ${
            isSidebarOpen ? 'text-xl opacity-100' : 'text-xs opacity-0 w-0'
          }`}
        >
          ECVN平台
        </h1>
        {!isSidebarOpen && (
          <i className="fas fa-bolt text-blue-400 text-2xl absolute" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-x-hidden">
        {navItems.map((item) => (
          <a
            key={item.label}
            href="#"
            className={`flex items-center px-3 py-3 rounded-lg transition-colors ${
              item.active
                ? 'bg-blue-600 text-white shadow-lg'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title={item.label}
            onClick={(e) => e.preventDefault()}
          >
            <i className={`${item.icon} text-lg w-8 text-center`} />
            {isSidebarOpen && (
              <span className={`ml-2 whitespace-nowrap ${item.active ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            )}
          </a>
        ))}
      </nav>
    </aside>
  );
}
