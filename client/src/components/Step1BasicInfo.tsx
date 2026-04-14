import { useRegistration } from '@/contexts/RegistrationContext';

export default function Step1BasicInfo() {
  const { appInfo, setAppInfo, setStep } = useRegistration();

  const isStep1Valid = appInfo.taxId.length >= 8 && appInfo.type !== '' && appInfo.agentName !== '';

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-blue-600">
        <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-4">
          <i className="fas fa-file-signature mr-2 text-blue-500" />
          1.1 註冊申請
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* 申請單編號 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              申請單編號 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={appInfo.appId}
              readOnly
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-500 font-mono focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* 申請日期 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              申請日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={appInfo.date}
              onChange={(e) => setAppInfo({ date: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 公司統編 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              公司統編 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={appInfo.taxId}
              onChange={(e) => setAppInfo({ taxId: e.target.value })}
              placeholder="請輸入 8 碼"
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 font-mono focus:border-blue-500 outline-none"
            />
          </div>

          {/* 代理人姓名 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              代理人姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={appInfo.agentName}
              onChange={(e) => setAppInfo({ agentName: e.target.value })}
              placeholder="請輸入代理人姓名"
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 申辦類型 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              申辦類型 <span className="text-red-500">*</span>
            </label>
            <select
              value={appInfo.type}
              onChange={(e) => setAppInfo({ type: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 font-bold focus:border-blue-500 outline-none"
            >
              <option value="" disabled>請選擇</option>
              <option value="註冊登記合格交易者">註冊登記合格交易者</option>
              <option value="資訊變更">資訊變更</option>
            </select>
          </div>

          {/* 申請單狀態 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              申請單狀態 <span className="text-red-500">*</span>
            </label>
            <select
              value={appInfo.status}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-blue-700 font-bold outline-none pointer-events-none"
            >
              <option value="書審通過">書審通過</option>
            </select>
          </div>
        </div>

        <div className="mt-10 flex justify-end">
          <button
            onClick={() => setStep(2)}
            disabled={!isStep1Valid}
            className={`px-8 py-3 rounded-lg font-bold text-white transition-all flex items-center shadow-lg ${
              isStep1Valid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            下一步：綁定轉直供契約 <i className="fas fa-arrow-right ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}
