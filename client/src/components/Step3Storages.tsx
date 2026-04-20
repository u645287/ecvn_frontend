import { useRegistration } from '@/contexts/RegistrationContext';
import { toast } from 'sonner';
import type { StorageDevice } from '@/types/index';

export default function Step3Storages() {
  const {
    storages, setStep,
    openStorageModal, editStorage, deleteStorage,
    appInfo, contracts,
    upsertApplication, goToRegistrationOverview,
  } = useRegistration();

  const handleComplete = () => {
    upsertApplication(appInfo);
    toast.success('代理人註冊與資產綁定已全數完成，資料已寫入系統！', {
      duration: 5000,
    });
    goToRegistrationOverview();
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        {/* Header */}
        <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              <i className="fas fa-battery-full mr-2 text-blue-500" />
              ETP 儲能綁定清單
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              透過 ETP 平台綁定 QSE / ID。綁定流程比照契約匯入，不需手動填入儲能參數。
            </p>
          </div>
          <button
            onClick={openStorageModal}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-blue-700 transition flex items-center"
          >
            <i className="fas fa-plus mr-2" /> 綁定 ETP
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold border-r border-white">QSE</th>
                <th className="px-4 py-3 font-bold border-r border-white">ID</th>
                <th className="px-4 py-3 font-bold border-r border-white">綁定狀態</th>
                <th className="px-4 py-3 font-bold text-center w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-bold">
                    尚未綁定任何 ETP 儲能資料
                  </td>
                </tr>
              ) : (
                storages.map((storage: StorageDevice, index: number) => (
                  <tr key={index} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-4 font-mono font-bold text-blue-700">{storage.qse}</td>
                    <td className="px-4 py-4 font-mono font-bold text-slate-700">{storage.id}</td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        {storage.verified ? '已綁定' : '未驗證'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => editStorage(index)}
                        className="text-blue-500 hover:text-blue-700 transition"
                        title="編輯"
                      >
                        <i className="fas fa-edit" />
                      </button>
                      <button
                        onClick={() => deleteStorage(index)}
                        className="text-red-500 hover:text-red-700 transition"
                        title="刪除"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t pt-6 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
          <button
            onClick={() => setStep(2)}
            className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-200 transition"
          >
            返回合約清單
          </button>
          <button
            onClick={handleComplete}
            className="px-8 py-3 rounded-lg font-black text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-lg"
          >
            <i className="fas fa-check-circle mr-2" /> 完成全部註冊流程
          </button>
        </div>
      </div>
    </div>
  );
}
