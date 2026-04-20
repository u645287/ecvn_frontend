/**
 * API 服務層
 * 
 * 目前使用模擬資料（Mock），未來替換為真正的 FastAPI 後端呼叫。
 * 所有 API 函式的簽名（參數與回傳型別）已按照正式規格定義，
 * 替換時只需修改此檔案中的實作即可。
 */

import type {
  VerifyContractResponse,
  VerifyEtpBindingResponse,
  SaveApplicationRequest,
  SaveApplicationResponse,
  AppInfo,
  Contract,
  StorageDevice,
} from '@/types/index';

// TODO: 替換為真正的 FastAPI 後端 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

/**
 * API 1: 驗證轉直供契約
 * POST /api/v1/contracts/verify
 */
export async function verifyContract(serviceId: string): Promise<VerifyContractResponse> {
  // === MOCK 模擬（開發用）===
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: {
          master: {
            applicant: '台灣半導體製造股份有限公司',
            serviceId: serviceId,
          },
          gen: {
            name: '南部科學園區一期光電案場',
            elecNo: '01-1234-56',
            meterNo: 'M109876543',
            capacity: 5000,
          },
          load: {
            name: '台南研發中心廠區',
            elecNo: '05-9876-54',
            meterNo: 'M301122334',
            capacity: 4500,
          },
        },
        message: 'CIS 資料庫連線成功，成功取得配對資料。',
      });
    }, 800);
  });

  // === 正式呼叫（取消註解後使用）===
  // const response = await fetch(`${API_BASE_URL}/contracts/verify`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ service_id: serviceId }),
  // });
  // if (!response.ok) throw new Error('驗證失敗');
  // return response.json();
}

/**
 * API 1-2: 驗證 ETP 儲能綁定資料
 * POST /api/v1/etp/verify
 */
export async function verifyEtpBinding(qse: string, id: string): Promise<VerifyEtpBindingResponse> {
  // === MOCK 模擬（開發用）===
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: {
          qse,
          id,
        },
        message: 'ETP 資料連線成功，已取得綁定資訊。',
      });
    }, 700);
  });

  // === 正式呼叫（取消註解後使用）===
  // const response = await fetch(`${API_BASE_URL}/etp/verify`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ qse, id }),
  // });
  // if (!response.ok) throw new Error('ETP 驗證失敗');
  // return response.json();
}

/**
 * API 2: 儲存申請單（草稿）
 * POST /api/v1/applications/draft
 */
export async function saveApplicationDraft(appInfo: AppInfo): Promise<{ success: boolean; message: string }> {
  // === MOCK ===
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true, message: '草稿已儲存' }), 300);
  });

  // === 正式呼叫 ===
  // const response = await fetch(`${API_BASE_URL}/applications/draft`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(appInfo),
  // });
  // return response.json();
}

/**
 * API 3: 完成全部註冊流程（最終提交）
 * POST /api/v1/applications/submit
 */
export async function submitApplication(
  data: SaveApplicationRequest
): Promise<SaveApplicationResponse> {
  // === MOCK ===
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        applicationId: data.appInfo.appId,
        message: '代理人註冊與資產綁定已全數完成，資料已寫入系統！',
      });
    }, 500);
  });

  // === 正式呼叫 ===
  // const response = await fetch(`${API_BASE_URL}/applications/submit`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data),
  // });
  // if (!response.ok) throw new Error('提交失敗');
  // return response.json();
}

/**
 * API 4: 讀取既有申請單（編輯模式）
 * GET /api/v1/applications/:appId
 */
export async function getApplication(appId: string): Promise<{
  appInfo: AppInfo;
  contracts: Contract[];
  storages: StorageDevice[];
} | null> {
  // === MOCK ===
  return null;

  // === 正式呼叫 ===
  // const response = await fetch(`${API_BASE_URL}/applications/${appId}`);
  // if (!response.ok) return null;
  // return response.json();
}
