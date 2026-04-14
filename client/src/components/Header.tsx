import { useRegistration } from '@/contexts/RegistrationContext';

function getStepTitle(step: number): string {
  if (step === 1) return '1.1 註冊申請';
  if (step === 2) return '第二步：轉直供契約驗證與綁定 (發電/用電配對)';
  if (step === 3) return '第三步：儲能設施綁定 (選填)';
  return '';
}

interface StepIndicatorProps {
  stepNum: number;
  label: string;
  currentStep: number;
}

function StepIndicator({ stepNum, label, currentStep }: StepIndicatorProps) {
  const isCompleted = currentStep > stepNum;
  const isActive = currentStep === stepNum;

  let className = 'step-inactive';
  if (isCompleted) className = 'step-completed';
  else if (isActive) className = 'step-active';

  return (
    <div className={`flex items-center ${className}`}>
      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs font-bold">
        {isCompleted ? <i className="fas fa-check" /> : stepNum}
      </div>
      <span className="font-bold text-sm">{label}</span>
    </div>
  );
}

export default function Header() {
  const { step, isSidebarOpen, setIsSidebarOpen, currentView } = useRegistration();
  const title = currentView === 'dashboard-agent-aggregation'
    ? '2.1 代理人資源聚合管理'
    : getStepTitle(step);

  return (
    <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
      <div className="flex items-center">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-slate-500 hover:text-blue-600 focus:outline-none mr-4 transition"
        >
          <i className="fas fa-bars text-xl" />
        </button>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      </div>

      {currentView === 'registration' && (
        <div className="hidden md:flex items-center space-x-2 text-sm font-bold">
          <StepIndicator stepNum={1} label="基本資料" currentStep={step} />
          <div className={`w-8 border-t-2 ${step >= 2 ? 'border-emerald-500' : 'border-slate-200'}`} />
          <StepIndicator stepNum={2} label="綁定契約 (發/用)" currentStep={step} />
          <div className={`w-8 border-t-2 ${step >= 3 ? 'border-emerald-500' : 'border-slate-200'}`} />
          <StepIndicator stepNum={3} label="綁定儲能" currentStep={step} />
        </div>
      )}
    </header>
  );
}
