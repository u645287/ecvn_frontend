import { RegistrationProvider, useRegistration } from '@/contexts/RegistrationContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Step1BasicInfo from '@/components/Step1BasicInfo';
import Step2Contracts from '@/components/Step2Contracts';
import Step3Storages from '@/components/Step3Storages';
import ContractModal from '@/components/ContractModal';
import StorageModal from '@/components/StorageModal';
import DashboardAgentAggregation from '@/components/DashboardAgentAggregation';
import DeclarationPlanPage from '@/components/DeclarationPlanPage';
import RegistrationOverview from '@/components/RegistrationOverview';

function MainContent() {
  const { step, currentView, registrationScreen } = useRegistration();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {currentView === 'registration' && (
            <>
              {registrationScreen === 'overview' && <RegistrationOverview />}
              {registrationScreen === 'form' && (
                <>
                  {step === 1 && <Step1BasicInfo />}
                  {step === 2 && <Step2Contracts />}
                  {step === 3 && <Step3Storages />}
                </>
              )}
            </>
          )}
          {currentView === 'dashboard-agent-aggregation' && <DashboardAgentAggregation />}
          {currentView === 'declaration-plan' && <DeclarationPlanPage />}
        </main>
      </div>

      {/* Modals */}
      <ContractModal />
      <StorageModal />
    </div>
  );
}

export default function Home() {
  return (
    <RegistrationProvider>
      <MainContent />
    </RegistrationProvider>
  );
}
