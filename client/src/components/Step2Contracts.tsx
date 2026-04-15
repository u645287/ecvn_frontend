import { useRegistration } from '@/contexts/RegistrationContext';

export default function Step2Contracts() {
  const {
    contracts, setStep, syncBusinessData, setContractSyncBusinessData, setAllContractsSyncBusinessData,
    openContractModal, editContract, deleteContract,
  } = useRegistration();

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        {/* Header */}
        <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              <i className="fas fa-file-contract mr-2 text-emerald-500" />
              代理轉直供契約清單
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              一張轉直供契約代表一組「發電端」與「用電端」的配對。請點擊匯入。
            </p>
          </div>
          <button
            onClick={openContractModal}
            className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-slate-700 transition flex items-center"
          >
            <i className="fas fa-plus mr-2" /> 匯入契約
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">主契約編號 (SERVICE_ID)</th>
                <th className="px-4 py-3 font-bold">申請者</th>
                <th className="px-4 py-3 font-bold border-l border-slate-200">發電端 (綠電案場) / 容量</th>
                <th className="px-4 py-3 font-bold border-l border-slate-200">用電端 (用戶負載) / 容量</th>
                <th className="px-4 py-3 font-bold text-center border-l border-slate-200 w-40">同步業務處資料</th>
                <th className="px-4 py-3 font-bold text-center border-l border-slate-200 w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <i className="fas fa-inbox text-4xl mb-3 text-slate-300 block" />
                    <p className="font-bold">尚未綁定任何轉直供契約</p>
                  </td>
                </tr>
              ) : (
                contracts.map((contract, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-4 font-mono font-bold text-blue-700">
                      {contract.dbData?.master.serviceId}
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-700">
                      {contract.dbData?.master.applicant}
                    </td>
                    <td className="px-4 py-4 border-l border-slate-100">
                      <p className="font-bold text-yellow-700">{contract.dbData?.gen.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        電號: <span className="font-mono">{contract.dbData?.gen.elecNo}</span>
                      </p>
                      <p className="text-xs font-bold text-slate-700 mt-1">
                        裝置容量: {contract.dbData?.gen.capacity} kW
                      </p>
                    </td>
                    <td className="px-4 py-4 border-l border-slate-100">
                      <p className="font-bold text-red-700">{contract.dbData?.load.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        電號: <span className="font-mono">{contract.dbData?.load.elecNo}</span>
                      </p>
                      <p className="text-xs font-bold text-slate-700 mt-1">
                        契約容量: {contract.dbData?.load.capacity} kW
                      </p>
                    </td>
                    <td className="px-4 py-4 border-l border-slate-100 text-center">
                      <div className="inline-flex items-center bg-slate-100 px-3 py-2 rounded-lg shadow-inner border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setContractSyncBusinessData(index, !contract.syncBusinessData)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            contract.syncBusinessData ? 'bg-blue-600' : 'bg-slate-400'
                          }`}
                          role="switch"
                          aria-checked={contract.syncBusinessData}
                          title="關閉時可保留/編修自建資料"
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              contract.syncBusinessData ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span
                          className={`text-xs font-black ml-2 w-6 ${
                            contract.syncBusinessData ? 'text-blue-600' : 'text-slate-500'
                          }`}
                        >
                          {contract.syncBusinessData ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 border-l border-slate-100 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => editContract(index)}
                        className="text-blue-500 hover:text-blue-700 transition"
                        title="編輯"
                      >
                        <i className="fas fa-edit" />
                      </button>
                      <button
                        onClick={() => deleteContract(index)}
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
        <div className="mt-8 flex justify-between items-center border-t border-slate-200 pt-6">
          <button
            onClick={() => setStep(1)}
            className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition"
          >
            返回上一步
          </button>

          <div className="flex items-center space-x-4">
            {/* Sync Toggle */}
            <div
              className="flex items-center bg-slate-100 px-4 py-2.5 rounded-lg shadow-inner border border-slate-200"
              title="一次將全部契約同步開關全開或全關"
            >
              <span className="text-sm font-bold text-slate-700 mr-3">同步業務處資料</span>
              <button
                type="button"
                onClick={() => setAllContractsSyncBusinessData(!syncBusinessData)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  syncBusinessData ? 'bg-blue-600' : 'bg-slate-400'
                }`}
                role="switch"
                aria-checked={syncBusinessData}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    syncBusinessData ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-xs font-black ml-2 w-6 ${
                  syncBusinessData ? 'text-blue-600' : 'text-slate-500'
                }`}
              >
                {syncBusinessData ? 'ON' : 'OFF'}
              </span>
            </div>

            <button
              onClick={() => setStep(3)}
              className="px-8 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg flex items-center"
            >
              下一步：綁定儲能設施 <i className="fas fa-arrow-right ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
