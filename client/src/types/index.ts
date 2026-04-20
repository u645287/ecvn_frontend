// === 代理人申請單 (Step 1) ===
export interface AppInfo {
  appId: string;
  date: string;
  taxId: string;
  agentName: string;
  type: string;
  status: string;
}

// === 轉直供契約 (Step 2) ===
export interface ContractEndpoint {
  name: string;
  elecNo: string;
  meterNo: string;
  capacity: number;
}

export interface ContractMaster {
  applicant: string;
  serviceId: string;
}

export interface ContractDbData {
  master: ContractMaster;
  gen: ContractEndpoint;
  load: ContractEndpoint;
}

export interface Contract {
  serviceId: string;
  verified: boolean;
  dbData: ContractDbData | null;
  /** true：以業務處(CIS)資料為準；false：允許保留/編修自建資料 */
  syncBusinessData: boolean;
}

// === 儲能設施 (Step 3) ===
export interface StorageFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'datetime-local';
}

export interface StorageDevice {
  qse: string;
  id: string;
  verified: boolean;
}

export interface VerifyEtpBindingResponse {
  success: boolean;
  data: {
    qse: string;
    id: string;
  } | null;
  message?: string;
}

// === API 相關型別 ===
export interface VerifyContractRequest {
  serviceId: string;
}

export interface VerifyContractResponse {
  success: boolean;
  data: ContractDbData | null;
  message?: string;
}

export interface SaveApplicationRequest {
  appInfo: AppInfo;
  contracts: Contract[];
  storages: StorageDevice[];
}

export interface SaveApplicationResponse {
  success: boolean;
  applicationId: string;
  message: string;
}
