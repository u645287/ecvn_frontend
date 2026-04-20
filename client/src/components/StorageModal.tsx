import { useRegistration } from '@/contexts/RegistrationContext';
import { verifyEtpBinding } from '@/lib/api';

export default function StorageModal() {
  const {
    isStorageModalOpen, editStorageIndex, tempStorage,
    closeStorageModal, setTempStorage, saveStorage,
    setIsVerifying, isVerifying,
  } = useRegistration();

  if (!isStorageModalOpen) return null;

  const isEditMode = editStorageIndex !== null;

  const handleVerify = async () => {
    if (!tempStorage.qse || !tempStorage.id) return;
    try {
      setIsVerifying(true);
      const result = await verifyEtpBinding(tempStorage.qse, tempStorage.id);
      if (result.success && result.data) {
        setTempStorage('qse', result.data.qse);
        setTempStorage('id', result.data.id);
        setTempStorage('verified', true);
      } else {
        setTempStorage('verified', false);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeStorageModal}
      />

      {/* Modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl z-10 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            <i className="fas fa-battery-full mr-2 text-blue-500" />
            {isEditMode ? '編輯 ETP 儲能綁定' : '新增 ETP 儲能綁定'}
          </h3>
          <button onClick={closeStorageModal} className="text-slate-400 hover:text-red-500">
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <div className="space-y-5">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">QSE</label>
                  <input
                    type="text"
                    value={tempStorage.qse}
                    onChange={(e) => {
                      setTempStorage('qse', e.target.value);
                      setTempStorage('verified', false);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition"
                    placeholder="請輸入 QSE"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">ID</label>
                  <input
                    type="text"
                    value={tempStorage.id}
                    onChange={(e) => {
                      setTempStorage('id', e.target.value);
                      setTempStorage('verified', false);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition"
                    placeholder="請輸入 ID"
                  />
                </div>
                <div>
                  <button
                    onClick={handleVerify}
                    disabled={!tempStorage.qse || !tempStorage.id || isVerifying}
                    className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold shadow hover:bg-blue-700 disabled:bg-slate-300 transition"
                  >
                    <i className={`fas ${isVerifying ? 'fa-spinner fa-spin' : 'fa-link'} mr-2`} />
                    {isVerifying ? '驗證中...' : '綁定 ETP'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              {tempStorage.verified ? (
                <div className="space-y-2 text-sm">
                  <p className="text-emerald-700 font-bold">
                    <i className="fas fa-check-circle mr-2" />
                    ETP 綁定驗證成功
                  </p>
                  <p className="text-slate-700">QSE：<span className="font-mono font-bold">{tempStorage.qse}</span></p>
                  <p className="text-slate-700">ID：<span className="font-mono font-bold">{tempStorage.id}</span></p>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">
                  尚未驗證。請輸入 QSE 與 ID 後點擊「綁定 ETP」。
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end space-x-3 shrink-0">
          <button onClick={closeStorageModal} className="px-6 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition">
            取消
          </button>
          <button
            onClick={saveStorage}
            disabled={!tempStorage.verified}
            className="px-8 py-2.5 rounded-lg font-bold transition shadow-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            <i className="fas fa-save mr-2" /> {isEditMode ? '儲存變更' : '確認綁定'}
          </button>
        </div>
      </div>
    </div>
  );
}
