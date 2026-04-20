import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AGENTS as INITIAL_AGENTS, type Agent as AggregationAgent } from '@/data/agentAggregation';
import type { AppInfo, Contract, StorageDevice } from '@/types/index';

interface RegistrationState {
  // UI 狀態
  isSidebarOpen: boolean;
  step: number;
  currentView: 'registration' | 'dashboard-agent-aggregation';
  registrationScreen: 'overview' | 'form';
  syncBusinessData: boolean;

  // Step 1
  appInfo: AppInfo;

  // Step 2
  contracts: Contract[];
  isContractModalOpen: boolean;
  isVerifying: boolean;
  editContractIndex: number | null;
  tempContract: Contract;

  // Step 3
  storages: StorageDevice[];
  isStorageModalOpen: boolean;
  editStorageIndex: number | null;
  tempStorage: StorageDevice;

  // Dashboard 2.1 / Overview 1.1 共用代理人資料
  agents: AggregationAgent[];
  applications: AppInfo[];
}

interface RegistrationActions {
  setIsSidebarOpen: (open: boolean) => void;
  setStep: (step: number) => void;
  setCurrentView: (view: 'registration' | 'dashboard-agent-aggregation') => void;
  setRegistrationScreen: (screen: 'overview' | 'form') => void;
  startNewRegistration: () => void;
  goToRegistrationOverview: () => void;
  setSyncBusinessData: (sync: boolean) => void;
  setContractSyncBusinessData: (index: number, sync: boolean) => void;
  setAllContractsSyncBusinessData: (sync: boolean) => void;
  setAppInfo: (info: Partial<AppInfo>) => void;

  // Contract actions
  openContractModal: () => void;
  editContract: (index: number) => void;
  deleteContract: (index: number) => void;
  closeContractModal: () => void;
  setTempContract: (contract: Partial<Contract>) => void;
  setTempContractDbData: (path: string, value: string | number) => void;
  setIsVerifying: (v: boolean) => void;
  saveAndNextContract: () => void;
  saveAndCloseContract: () => void;

  // Storage actions
  openStorageModal: () => void;
  editStorage: (index: number) => void;
  deleteStorage: (index: number) => void;
  closeStorageModal: () => void;
  setTempStorage: (field: string, value: string | boolean) => void;
  saveStorage: () => void;

  // Agents actions
  setAgents: (agents: AggregationAgent[]) => void;
  updateAgent: (id: number, patch: Partial<AggregationAgent>) => void;
  deleteAgent: (id: number) => void;

  // Applications actions
  upsertApplication: (app: AppInfo) => void;
  deleteApplication: (appId: string) => void;
  loadApplicationToForm: (appId: string) => void;
}

const RegistrationContext = createContext<(RegistrationState & RegistrationActions) | null>(null);

const createEmptyContract = (): Contract => ({
  serviceId: '',
  verified: false,
  dbData: null,
  syncBusinessData: true,
});

const createEmptyStorage = (): StorageDevice => ({
  qse: '',
  id: '',
  verified: false,
});

const createInitialAppInfo = (): AppInfo => ({
  appId: 'APP-' + Date.now().toString().slice(-8),
  date: new Date().toISOString().split('T')[0],
  taxId: '',
  agentName: '',
  type: '',
  status: '已完成',
});

const createInitialApplications = (): AppInfo[] => {
  const today = new Date().toISOString().split('T')[0];
  return INITIAL_AGENTS.map((agent) => ({
    appId: `APP-AGENT-${agent.id}`,
    date: today,
    taxId: agent.taxId,
    agentName: agent.name,
    type: agent.registrationType,
    status: '已完成',
  }));
};

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [step, setStep] = useState(1);
  const [currentView, setCurrentView] = useState<'registration' | 'dashboard-agent-aggregation'>('registration');
  const [registrationScreen, setRegistrationScreen] = useState<'overview' | 'form'>('overview');
  const [syncBusinessData, setSyncBusinessData] = useState(true);

  const [appInfo, setAppInfoState] = useState<AppInfo>(createInitialAppInfo());

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [editContractIndex, setEditContractIndex] = useState<number | null>(null);
  const [tempContract, setTempContractState] = useState<Contract>(createEmptyContract());

  const [storages, setStorages] = useState<StorageDevice[]>([]);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [editStorageIndex, setEditStorageIndex] = useState<number | null>(null);
  const [tempStorage, setTempStorageState] = useState<StorageDevice>(createEmptyStorage());

  const [agents, setAgentsState] = useState<AggregationAgent[]>(() => JSON.parse(JSON.stringify(INITIAL_AGENTS)));
  const [applications, setApplications] = useState<AppInfo[]>(createInitialApplications);

  const syncAgentsFromApplications = useCallback((apps: AppInfo[]) => {
    setAgentsState((prev) => {
      let next = [...prev];
      const completed = apps.filter((a) => a.status === '已完成');

      completed.forEach((app) => {
        const existingIndex = next.findIndex(
          (a) => a.taxId === app.taxId || a.name === app.agentName
        );
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            name: app.agentName,
            taxId: app.taxId,
            registrationType: app.type || next[existingIndex].registrationType,
          };
          return;
        }

        const newId =
          next.length > 0 ? Math.max(...next.map((a) => a.id)) + 1 : 1;
        next.push({
          id: newId,
          name: app.agentName || '未命名申請',
          taxId: app.taxId || '',
          registrationType: app.type || '註冊登記合格交易者',
          genCap: 0,
          loadCap: 0,
          storageCap: 0,
          genMeters: 0,
          loadMeters: 0,
          bessCount: 0,
          genList: [],
          loadList: [],
          storageList: [],
        });
      });

      return next;
    });
  }, []);

  const setAppInfo = useCallback((info: Partial<AppInfo>) => {
    setAppInfoState((prev) => ({ ...prev, ...info }));
  }, []);

  const setAgents = useCallback((nextAgents: AggregationAgent[]) => {
    setAgentsState(JSON.parse(JSON.stringify(nextAgents)));
  }, []);

  const updateAgent = useCallback((id: number, patch: Partial<AggregationAgent>) => {
    setAgentsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...JSON.parse(JSON.stringify(patch)) } : a))
    );
  }, []);

  const deleteAgent = useCallback((id: number) => {
    // 二次確認
    if (!window.confirm('是否確認真的要刪除這個代理人？')) return;
    if (!window.confirm('此操作無法復原，是否仍要刪除？')) return;
    setAgentsState((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const upsertApplication = useCallback((app: AppInfo) => {
    const normalized: AppInfo = {
      ...app,
      status: app.status || '已完成',
      date: app.date || new Date().toISOString().split('T')[0],
      appId: app.appId || `APP-${Date.now().toString().slice(-8)}`,
    };
    setApplications((prev) => {
      const idx = prev.findIndex((a) => a.appId === normalized.appId);
      const next = [...prev];
      if (idx >= 0) next[idx] = normalized;
      else next.unshift(normalized);
      syncAgentsFromApplications(next);
      return next;
    });
  }, [syncAgentsFromApplications]);

  const deleteApplication = useCallback((appId: string) => {
    setApplications((prev) => {
      const next = prev.filter((a) => a.appId !== appId);
      syncAgentsFromApplications(next);
      return next;
    });
  }, [syncAgentsFromApplications]);

  const loadApplicationToForm = useCallback((appId: string) => {
    const found = applications.find((a) => a.appId === appId);
    if (!found) return;
    setCurrentView('registration');
    setRegistrationScreen('form');
    setStep(1);
    setAppInfoState({ ...found });
  }, [applications]);

  const setContractSyncBusinessData = useCallback((index: number, sync: boolean) => {
    setContracts((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      next[index] = { ...target, syncBusinessData: sync };
      return next;
    });
  }, []);

  const setAllContractsSyncBusinessData = useCallback((sync: boolean) => {
    setSyncBusinessData(sync);
    setContracts((prev) => prev.map((c) => ({ ...c, syncBusinessData: sync })));
  }, []);

  const openContractModal = useCallback(() => {
    setEditContractIndex(null);
    setTempContractState({ ...createEmptyContract(), syncBusinessData });
    setIsContractModalOpen(true);
  }, [syncBusinessData]);

  const editContract = useCallback((index: number) => {
    setEditContractIndex(index);
    setTempContractState(JSON.parse(JSON.stringify(contracts[index])));
    setIsContractModalOpen(true);
  }, [contracts]);

  const deleteContract = useCallback((index: number) => {
    if (window.confirm('確定要刪除這筆轉直供契約嗎？')) {
      setContracts((prev) => prev.filter((_, i) => i !== index));
    }
  }, []);

  const closeContractModal = useCallback(() => {
    setIsContractModalOpen(false);
  }, []);

  const setTempContract = useCallback((contract: Partial<Contract>) => {
    setTempContractState((prev) => ({ ...prev, ...contract }));
  }, []);

  const setTempContractDbData = useCallback((path: string, value: string | number) => {
    setTempContractState((prev) => {
      if (!prev.dbData) return prev;
      const newData = JSON.parse(JSON.stringify(prev.dbData));
      const parts = path.split('.');
      let obj: Record<string, unknown> = newData;
      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]] as Record<string, unknown>;
      }
      obj[parts[parts.length - 1]] = value;
      return { ...prev, dbData: newData };
    });
  }, []);

  const saveAndNextContract = useCallback(() => {
    if (tempContract.verified) {
      setContracts((prev) => [...prev, JSON.parse(JSON.stringify(tempContract))]);
      setTempContractState(createEmptyContract());
    }
  }, [tempContract]);

  const saveAndCloseContract = useCallback(() => {
    if (tempContract.verified) {
      if (editContractIndex !== null) {
        setContracts((prev) => {
          const next = [...prev];
          next[editContractIndex] = JSON.parse(JSON.stringify(tempContract));
          return next;
        });
      } else {
        setContracts((prev) => [...prev, JSON.parse(JSON.stringify(tempContract))]);
      }
      setIsContractModalOpen(false);
    }
  }, [tempContract, editContractIndex]);

  const openStorageModal = useCallback(() => {
    setEditStorageIndex(null);
    setTempStorageState(createEmptyStorage());
    setIsStorageModalOpen(true);
  }, []);

  const editStorage = useCallback((index: number) => {
    setEditStorageIndex(index);
    setTempStorageState(JSON.parse(JSON.stringify(storages[index])));
    setIsStorageModalOpen(true);
  }, [storages]);

  const deleteStorage = useCallback((index: number) => {
    if (window.confirm('確定要刪除這筆儲能設備嗎？')) {
      setStorages((prev) => prev.filter((_, i) => i !== index));
    }
  }, []);

  const closeStorageModal = useCallback(() => {
    setIsStorageModalOpen(false);
  }, []);

  const setTempStorageField = useCallback((field: string, value: string | boolean) => {
    setTempStorageState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const saveStorage = useCallback(() => {
    if (editStorageIndex !== null) {
      setStorages((prev) => {
        const next = [...prev];
        next[editStorageIndex] = JSON.parse(JSON.stringify(tempStorage));
        return next;
      });
    } else {
      setStorages((prev) => [...prev, JSON.parse(JSON.stringify(tempStorage))]);
    }
    setIsStorageModalOpen(false);
  }, [tempStorage, editStorageIndex]);

  const startNewRegistration = useCallback(() => {
    setCurrentView('registration');
    setRegistrationScreen('form');
    setStep(1);
    setAppInfoState(createInitialAppInfo());
    setContracts([]);
    setStorages([]);
    setTempContractState(createEmptyContract());
    setTempStorageState(createEmptyStorage());
  }, []);

  const goToRegistrationOverview = useCallback(() => {
    setCurrentView('registration');
    setRegistrationScreen('overview');
  }, []);

  const value: RegistrationState & RegistrationActions = {
    isSidebarOpen, step, currentView, registrationScreen, syncBusinessData,
    appInfo, contracts, isContractModalOpen, isVerifying, editContractIndex, tempContract,
    storages, isStorageModalOpen, editStorageIndex, tempStorage,
    agents, applications,
    setIsSidebarOpen, setStep, setCurrentView, setRegistrationScreen, startNewRegistration, goToRegistrationOverview, setSyncBusinessData, setContractSyncBusinessData, setAllContractsSyncBusinessData, setAppInfo,
    openContractModal, editContract, deleteContract, closeContractModal,
    setTempContract, setTempContractDbData, setIsVerifying,
    saveAndNextContract, saveAndCloseContract,
    openStorageModal, editStorage, deleteStorage, closeStorageModal,
    setTempStorage: setTempStorageField, saveStorage,
    setAgents, updateAgent, deleteAgent,
    upsertApplication, deleteApplication, loadApplicationToForm,
  };

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const ctx = useContext(RegistrationContext);
  if (!ctx) throw new Error('useRegistration must be used within RegistrationProvider');
  return ctx;
}
