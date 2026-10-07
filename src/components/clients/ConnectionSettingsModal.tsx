import React, { useState } from 'react';
import {
  X,
  Server,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Radio,
  Clock,
  Database,
  Unplug,
  Zap,
} from 'lucide-react';
import { ClientCompany, DataSourceType, LiveConnectionConfig } from '../../clients/clientModel';
import { TallyConnector } from '../../connectors/tallyConnector';
import { ZohoBooksConnector } from '../../connectors/zohoConnector';
import { ConnectionTestResult } from '../../connectors/accountingConnector';

interface ConnectionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientCompany | null;
  onUpdateClientConnection: (
    clientId: string,
    dataSourceType: DataSourceType,
    liveConfig: LiveConnectionConfig,
    connectionStatus: 'CONNECTED' | 'FILE_LOADED' | 'SYNC_PENDING' | 'SYNC_FAILED'
  ) => void;
  onTriggerSync: (clientId: string, fullSync: boolean) => void;
}

export const ConnectionSettingsModal: React.FC<ConnectionSettingsModalProps> = ({
  isOpen,
  onClose,
  client,
  onUpdateClientConnection,
  onTriggerSync,
}) => {
  if (!isOpen || !client) return null;

  const initialMode = client.dataSourceType === 'LIVE' || client.dataSourceType === 'FILE' ? client.dataSourceType : 'FILE';
  const [mode, setMode] = useState<DataSourceType>(initialMode);
  // Tally state
  const [tallyHost, setTallyHost] = useState(client.liveConfig?.tallyHost || 'localhost');
  const [tallyPort, setTallyPort] = useState(client.liveConfig?.tallyPort || 9000);
  const [tallyCompany, setTallyCompany] = useState(client.liveConfig?.tallyCompany || client.name);

  // Zoho state
  const [zohoOrgId, setZohoOrgId] = useState(client.liveConfig?.zohoOrgId || '');
  const [zohoOrgName, setZohoOrgName] = useState(client.liveConfig?.zohoOrgName || client.name);
  const [zohoDataCenter, setZohoDataCenter] = useState<'in' | 'com' | 'eu' | 'com.au'>(
    client.liveConfig?.zohoDataCenter || 'in'
  );
  const [zohoAccessToken, setZohoAccessToken] = useState(client.liveConfig?.zohoAccessToken || '');

  // Testing status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (client.software === 'TallyPrime') {
        const res = await TallyConnector.testConnection({
          software: 'TallyPrime',
          tallyHost,
          tallyPort: Number(tallyPort),
          tallyCompany,
        });
        setTestResult(res);
      } else {
        const res = await ZohoBooksConnector.testConnection({
          software: 'Zoho Books',
          zohoOrgId,
          zohoDataCenter,
          zohoAccessToken,
        });
        setTestResult(res);
      }
    } catch (err: any) {
      setTestResult({
        status: 'FAILED',
        message: err.message || 'Connection test probe failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const liveConfig: LiveConnectionConfig = {
      tallyHost: tallyHost.trim(),
      tallyPort: Number(tallyPort),
      tallyCompany: tallyCompany.trim(),
      zohoOrgId: zohoOrgId.trim(),
      zohoOrgName: zohoOrgName.trim(),
      zohoDataCenter,
      zohoAccessToken: zohoAccessToken.trim() || undefined,
    };

    let newStatus: 'CONNECTED' | 'FILE_LOADED' | 'SYNC_PENDING' | 'SYNC_FAILED' = 'CONNECTED';
    if (mode === 'FILE') {
      newStatus = 'FILE_LOADED';
    } else if (mode === 'LIVE') {
      newStatus = testResult?.status === 'CONNECTED' ? 'CONNECTED' : 'SYNC_PENDING';
    }

    onUpdateClientConnection(client.id, mode, liveConfig, newStatus);
    onClose();
  };

  const handleDisconnect = () => {
    onUpdateClientConnection(client.id, 'FILE', client.liveConfig || {}, 'FILE_LOADED');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Connection Settings</h3>
              <p className="text-xs text-slate-500">
                {client.name} · {client.software}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Data Source Selector: LIVE vs FILE vs BENCHMARK */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Data Source Mode</label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('LIVE')}
              className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                mode === 'LIVE'
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" /> Live Connection
                </span>
                {mode === 'LIVE' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
              </div>
              <span className="text-[10px] text-slate-500">Direct {client.software} API/ODBC</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('FILE')}
              className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                mode === 'FILE'
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-indigo-600" /> File Import
                </span>
                {mode === 'FILE' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
              </div>
              <span className="text-[10px] text-slate-500">XML, Excel, CSV, JSON</span>
            </button>

          </div>
        </div>

        {/* Tally Configuration */}
        {client.software === 'TallyPrime' ? (
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div className="font-semibold text-slate-800 flex items-center justify-between">
              <span>TallyPrime XML Gateway Parameters</span>
              <span className="text-[11px] text-slate-500 font-mono">Port 9000 (Default)</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-slate-600 mb-1">Tally Host / IP</label>
                <input
                  type="text"
                  value={tallyHost}
                  onChange={(e) => setTallyHost(e.target.value)}
                  placeholder="localhost or 192.168.1.10"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Port</label>
                <input
                  type="number"
                  value={tallyPort}
                  onChange={(e) => setTallyPort(Number(e.target.value))}
                  placeholder="9000"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Company Name in Tally</label>
              <input
                type="text"
                value={tallyCompany}
                onChange={(e) => setTallyCompany(e.target.value)}
                placeholder="Must match company opened in TallyPrime"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900"
              />
            </div>
          </div>
        ) : (
          /* Zoho Configuration */
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div className="font-semibold text-slate-800 flex items-center justify-between">
              <span>Zoho Books OAuth & Organization Config</span>
              <span className="text-[11px] text-slate-500 font-mono">books.zoho.{zohoDataCenter}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-slate-600 mb-1">Organization ID</label>
                <input
                  type="text"
                  value={zohoOrgId}
                  onChange={(e) => setZohoOrgId(e.target.value)}
                  placeholder="e.g. 809214772"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Data Center</label>
                <select
                  value={zohoDataCenter}
                  onChange={(e) => setZohoDataCenter(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                >
                  <option value="in">India (.in)</option>
                  <option value="com">US (.com)</option>
                  <option value="eu">Europe (.eu)</option>
                  <option value="com.au">Australia (.com.au)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 mb-1">OAuth Access Token (Optional Manual Override)</label>
              <input
                type="password"
                value={zohoAccessToken}
                onChange={(e) => setZohoAccessToken(e.target.value)}
                placeholder="1000.xxxxxxxxx (Leave empty to use server secrets)"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
              />
            </div>
          </div>
        )}

        {/* Test Connection Button & Result */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 text-white transition-colors"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Test {client.software} Connection</span>
            </button>

            {client.lastSyncTimestamp && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last Sync: {new Date(client.lastSyncTimestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                testResult.status === 'CONNECTED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                {testResult.status === 'CONNECTED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span>Status: {testResult.status}</span>
                {testResult.latencyMs && (
                  <span className="font-normal font-mono text-[10px] text-slate-500 ml-auto">
                    {testResult.latencyMs}ms
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed">{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onTriggerSync(client.id, false);
                onClose();
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              title="Pull changes incrementally"
            >
              Sync Now
            </button>

            <button
              type="button"
              onClick={() => {
                onTriggerSync(client.id, true);
                onClose();
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              title="Force full re-download of all transactions"
            >
              Full Sync
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
              title="Disconnect live integration"
            >
              <Unplug className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
