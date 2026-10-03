import React, { useState } from 'react';
import { X, Building2, UploadCloud, Plus } from 'lucide-react';
import { ClientCompany } from '../../clients/clientModel';
import { AccountingSoftware } from '../../normalizer/commonModel';
import { normalizeAccountingData } from '../../normalizer/normalizer';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClient: (newClient: ClientCompany) => void;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  onAddClient,
}) => {
  const [name, setName] = useState('');
  const [software, setSoftware] = useState<AccountingSoftware>('TallyPrime');
  const [gstin, setGstin] = useState('');
  const [industry, setIndustry] = useState('Manufacturing');
  const [group, setGroup] = useState('Default Group');
  const [endpoint, setEndpoint] = useState('');
  const [orgId, setOrgId] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedTx, setParsedTx] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setErrorMsg('');
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      let content: string | ArrayBuffer;
      if (extension === 'xlsx' || extension === 'xls') {
        content = await file.arrayBuffer();
      } else {
        content = await file.text();
      }

      const txs = await normalizeAccountingData(content, file.name, software, name || 'New Client');
      setParsedTx(txs);
      setUploadedFileName(file.name);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a company name.');
      return;
    }

    const newClient: ClientCompany = {
      id: `client-custom-${Date.now()}`,
      name: name.trim(),
      software,
      gstin: gstin.trim().toUpperCase() || 'UNREGISTERED',
      industry: industry.trim() || 'General Business',
      group: group.trim() || 'General',
      connectionStatus: parsedTx.length > 0 ? 'FILE_LOADED' : 'CONNECTED',
      dataSourceType: parsedTx.length > 0 ? 'FILE' : 'LIVE',
      liveConfig: {
        tallyHost: software === 'TallyPrime' ? (endpoint || 'localhost') : undefined,
        tallyPort: 9000,
        tallyCompany: software === 'TallyPrime' ? name.trim() : undefined,
        zohoOrgId: software === 'Zoho Books' ? (orgId || undefined) : undefined,
        zohoOrgName: software === 'Zoho Books' ? name.trim() : undefined,
        zohoDataCenter: 'in',
      },
      connectionEndpoint: software === 'TallyPrime' ? (endpoint || 'http://localhost:9000') : undefined,
      organizationId: software === 'Zoho Books' ? (orgId || 'Zoho Books Client') : undefined,
      periodFrom: '2024-04-01',
      periodTo: '2024-04-30',
      transactions: parsedTx,
      activeFileName: uploadedFileName || (software === 'TallyPrime' ? 'Direct Tally Connect' : 'Direct Zoho Books Connect'),
      isSelected: true,
      reviewStatus: 'IDLE',
      syncLogs: [
        {
          timestamp: new Date().toLocaleTimeString('en-GB'),
          level: 'info',
          message: `Client entity ${name.trim()} configured. Connection mode: ${parsedTx.length > 0 ? 'FILE' : 'LIVE'}`,
        },
      ],
    };

    onAddClient(newClient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Add Connected Client</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Company Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company / Entity Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Industrial Solutions Pvt Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900"
            />
          </div>

          {/* Software Choice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Accounting Software</label>
              <select
                value={software}
                onChange={(e) => setSoftware(e.target.value as AccountingSoftware)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900"
              >
                <option value="TallyPrime">TallyPrime</option>
                <option value="Zoho Books">Zoho Books</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                placeholder="27AAACB1234F1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-xs text-slate-900 uppercase"
              />
            </div>
          </div>

          {/* Industry & Client Group */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Industry Sector</label>
              <input
                type="text"
                placeholder="Manufacturing / IT / Retail"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Client Group / Tag</label>
              <input
                type="text"
                placeholder="Audit Batch 2024"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Connection Config */}
          {software === 'TallyPrime' ? (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tally Gateway Endpoint (XML / ODBC Port)
              </label>
              <input
                type="text"
                placeholder="http://localhost:9000"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-xs text-slate-900"
              />
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Zoho Books Organization ID
              </label>
              <input
                type="text"
                placeholder="e.g. 789123456"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-xs text-slate-900"
              />
            </div>
          )}

          {/* Optional Initial Data File */}
          <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700">Attach Initial Accounting Data (Optional)</span>
              <span className="text-[10px] text-slate-400">XML / CSV / Excel / JSON</span>
            </div>
            <input
              type="file"
              accept=".xml,.csv,.xlsx,.xls,.json"
              onChange={handleFileUpload}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-white hover:file:bg-slate-100"
            />
            {isParsing && <div className="text-[11px] text-indigo-600 mt-1">Parsing accounting data...</div>}
            {uploadedFileName && !isParsing && (
              <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                Loaded {parsedTx.length} transactions from {uploadedFileName}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
