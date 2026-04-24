import { useRegistration } from '@/contexts/RegistrationContext';

function getStepTitle(step: number): string {
  if (step === 1) return '1. 基本資料';
  if (step === 2) return '2. 綁定契約';
  if (step === 3) return '3. 綁定儲能';
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

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black transition-all ${
          isCompleted
            ? 'border-emerald-400 bg-emerald-500/25 text-emerald-300'
            : isActive
              ? 'process-step-active'
              : 'border-slate-500 bg-slate-700/30 text-slate-300'
        }`}
      >
        {isCompleted ? <i className="fas fa-check" /> : stepNum}
      </div>
      <span
        className={`text-base md:text-lg font-bold tracking-wide ${
          isActive ? 'text-amber-300' : isCompleted ? 'text-emerald-300' : 'text-slate-300'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function Header() {
  const {
    step,
    isSidebarOpen,
    setIsSidebarOpen,
    currentView,
    registrationScreen,
    goToRegistrationOverview,
  } = useRegistration();

  const isRegistrationForm = currentView === 'registration' && registrationScreen === 'form';

  const title =
    currentView === 'dashboard-agent-aggregation'
      ? '2.1 代理人資源聚合管理'
      : currentView === 'dashboard-realtime-generation'
        ? '2.3 即時發電量監控'
        : currentView === 'declaration-plan'
          ? '3. 申報計畫'
          : currentView === 'settlement-pre'
            ? '4.1 預結算'
          : registrationScreen === 'overview'
            ? '註冊申請總覽'
            : getStepTitle(step);

  return (
    <header
      className={`${
        isRegistrationForm ? 'h-28' : 'h-16'
      } bg-slate-900 text-white shadow-sm px-6 sticky top-0 z-10 shrink-0 transition-all duration-500`}
    >
      <div className="h-full flex items-center">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-slate-300 hover:text-blue-300 focus:outline-none mr-4 transition"
        >
          <i className="fas fa-bars text-xl" />
        </button>
        {isRegistrationForm ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <h2 className="text-base md:text-lg font-bold text-slate-200 tracking-wide">{title}</h2>
            <div className="flex items-center gap-4 md:gap-6">
              <StepIndicator stepNum={1} label="基本資料" currentStep={step} />
              <div className={`w-10 md:w-14 border-t-2 ${step >= 2 ? 'border-emerald-400' : 'border-slate-600'}`} />
              <StepIndicator stepNum={2} label="綁定契約" currentStep={step} />
              <div className={`w-10 md:w-14 border-t-2 ${step >= 3 ? 'border-emerald-400' : 'border-slate-600'}`} />
              <StepIndicator stepNum={3} label="綁定儲能" currentStep={step} />
            </div>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-slate-100">{title}</h2>
        )}

        {isRegistrationForm && (
          <button
            onClick={goToRegistrationOverview}
            className="ml-4 px-4 py-2 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-100 text-sm font-bold transition"
          >
            返回註冊總覽
          </button>
        )}
      </div>
    </header>
  );
}
