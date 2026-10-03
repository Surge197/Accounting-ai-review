import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Sparkles,
  Server,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  Zap,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ApiSettingsStatus {
  openai: {
    isConfigured: boolean;
    apiKeyMasked?: string;
    defaultModel: string;
    supportedModels: string[];
  };
  gemini: {
    isConfigured: boolean;
    defaultModel: string;
    supportedModels: string[];
  };
  zoho: {
    isConfigured: boolean;
    clientId?: string;
    dataCenter: string;
    hasToken?: boolean;
  };
  tally: {
    defaultHost: string;
    defaultPort: number;
  };
}

interface ApiIntegrationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const ApiIntegrationSettingsModal: React.FC<ApiIntegrationSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'openai' | 'zoho' | 'tally'>('openai');

  // Form states
  const [openAiKey, setOpenAiKey] = useState('');
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [openAiModel, setOpenAiModel] = useState('gpt-4o-mini');
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini'>('openai');

  const [zohoClientId, setZohoClientId] = useState('');
  const [zohoClientSecret, setZohoClientSecret] = useState('');
  const [zohoAccessToken, setZohoAccessToken] = useState('');
  const [showZohoToken, setShowZohoToken] = useState(false);
  const [zohoDataCenter, setZohoDataCenter] = useState<'in' | 'com' | 'eu' | 'com.au'>('in');
  const [zohoTestOrgId, setZohoTestOrgId] = useState('');

  const [tallyHost, setTallyHost] = useState('localhost');
  const [tallyPort, setTallyPort] = useState(9000);
  const [tallyTestCompany, setTallyTestCompany] = useState('');

  // Status & testing
  const [serverStatus, setServerStatus] = useState<ApiSettingsStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const [testResult, setTestResult] = useState<{
    tab: 'openai' | 'zoho' | 'tally';
    status: 'SUCCESS' | 'ERROR' | 'INFO';
    message: string;
    latencyMs?: number;
    details?: any;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Accordion for Tally Setup Instructions
  const [showTallyGuide, setShowTallyGuide] = useState(true);

  // Load server status & local storage on mount
  useEffect(() => {
    fetchStatus();
    // Load cached client preferences
    const cached = localStorage.getItem('accounting_ai_integration_settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.openAiModel) setOpenAiModel(parsed.openAiModel);
        if (parsed.aiProvider) setAiProvider(parsed.aiProvider);
        if (parsed.zohoDataCenter) setZohoDataCenter(parsed.zohoDataCenter);
        if (parsed.tallyHost) setTallyHost(parsed.tallyHost);
        if (parsed.tallyPort) setTallyPort(parsed.tallyPort);
        if (parsed.tallyTestCompany) setTallyTestCompany(parsed.tallyTestCompany);
        if (parsed.zohoTestOrgId) setZohoTestOrgId(parsed.zohoTestOrgId);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/settings/status');
      if (res.ok) {
        const data: ApiSettingsStatus = await res.json();
        setServerStatus(data);
        if (data.openai.defaultModel) setOpenAiModel(data.openai.defaultModel);
        if (data.tally.defaultHost) setTallyHost(data.tally.defaultHost);
        if (data.tally.defaultPort) setTallyPort(data.tally.defaultPort);
        if (data.zoho.dataCenter) setZohoDataCenter(data.zoho.dataCenter as any);
      }
    } catch (e) {
      console.warn('Failed to fetch API settings status:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Test OpenAI connection
  const handleTestOpenAi = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          model: openAiModel,
          apiKey: openAiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          tab: 'openai',
          status: 'SUCCESS',
          message: `Connected successfully to OpenAI (${data.model}). Latency: ${data.latencyMs}ms. Response: "${data.message}"`,
          latencyMs: data.latencyMs,
        });
      } else {
        setTestResult({
          tab: 'openai',
          status: 'ERROR',
          message: data.error || 'Failed to authenticate with OpenAI API.',
          latencyMs: data.latencyMs,
        });
      }
    } catch (err: any) {
      setTestResult({
        tab: 'openai',
        status: 'ERROR',
        message: `Network error probing OpenAI: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Test Zoho Books connection
  const handleTestZoho = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/zoho/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: zohoTestOrgId.trim() || undefined,
          dataCenter: zohoDataCenter,
          accessToken: zohoAccessToken.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.status === 'CONNECTED') {
        setTestResult({
          tab: 'zoho',
          status: 'SUCCESS',
          message: data.message || 'Connected to Zoho Books Organization successfully.',
          details: data.details,
        });
      } else {
        setTestResult({
          tab: 'zoho',
          status: 'ERROR',
          message: `[${data.status}] ${data.message || 'Connection test failed.'}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        tab: 'zoho',
        status: 'ERROR',
        message: `Network probe failed: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Test Tally connection
  const handleTestTally = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/tally/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: tallyHost.trim() || 'localhost',
          port: Number(tallyPort) || 9000,
          company: tallyTestCompany.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.status === 'CONNECTED') {
        setTestResult({
          tab: 'tally',
          status: 'SUCCESS',
          message: data.message,
          latencyMs: data.latencyMs,
          details: data.details,
        });
      } else {
        setTestResult({
          tab: 'tally',
          status: 'ERROR',
          message: `[${data.status}] ${data.message}`,
          latencyMs: data.latencyMs,
        });
      }
    } catch (err: any) {
      setTestResult({
        tab: 'tally',
        status: 'ERROR',
        message: `Could not reach Tally gateway: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save Settings to Backend Runtime & LocalStorage
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        openai: {
          apiKey: openAiKey.trim() || undefined,
          defaultModel: openAiModel,
        },
        zoho: {
          clientId: zohoClientId.trim() || undefined,
          accessToken: zohoAccessToken.trim() || undefined,
          dataCenter: zohoDataCenter,
        },
        tally: {
          host: tallyHost.trim() || 'localhost',
          port: Number(tallyPort) || 9000,
        },
      };

      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Cache non-secret settings in localStorage
        localStorage.setItem(
          'accounting_ai_integration_settings',
          JSON.stringify({
            openAiModel,
            aiProvider,
            zohoDataCenter,
            tallyHost,
            tallyPort,
            tallyTestCompany,
            zohoTestOrgId,
          })
        );

        setSaveSuccess(true);
        fetchStatus();
        onSettingsSaved?.();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">API Integration Settings</h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Global Configuration
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure direct connectivity for OpenAI, Zoho Books, and TallyPrime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Integration Status Badges */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          {/* OpenAI Badge */}
          <button
            type="button"
            onClick={() => setActiveTab('openai')}
            className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
              activeTab === 'openai'
                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                OpenAI
              </span>
              {serverStatus?.openai.isConfigured ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" title="Configured" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Fallback active" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 truncate">
              {serverStatus?.openai.isConfigured ? 'Active (GPT-4o)' : 'Fallback / Heuristics'}
            </span>
          </button>

          {/* Zoho Books Badge */}
          <button
            type="button"
            onClick={() => setActiveTab('zoho')}
            className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
              activeTab === 'zoho'
                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                Zoho Books
              </span>
              {serverStatus?.zoho.isConfigured ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" title="Configured" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-300" title="Needs token/config" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 truncate">
              {serverStatus?.zoho.isConfigured ? `OAuth Ready (.${serverStatus.zoho.dataCenter})` : 'Multi-Org OAuth'}
            </span>
          </button>

          {/* TallyPrime Badge */}
          <button
            type="button"
            onClick={() => setActiveTab('tally')}
            className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
              activeTab === 'tally'
                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-blue-600" />
                TallyPrime
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-100" title="Gateway Listener" />
            </div>
            <span className="text-[10px] text-slate-500 truncate font-mono">
              {tallyHost}:{tallyPort}
            </span>
          </button>
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* ========================================================
              TAB 1: OPENAI CONFIGURATION
             ======================================================== */}
          {activeTab === 'openai' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">OpenAI API Key & Model Configuration</span>
                  {serverStatus?.openai.isConfigured && (
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Server Key: {serverStatus.openai.apiKeyMasked}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    OpenAI API Key (Bearer Secret)
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenAiKey ? 'text' : 'password'}
                      value={openAiKey}
                      onChange={(e) => setOpenAiKey(e.target.value)}
                      placeholder={serverStatus?.openai.isConfigured ? 'Key active on server (type to override)' : 'sk-proj-...'}
                      className="w-full px-2.5 py-1.5 pr-8 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showOpenAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Used for AI audit explanations across all client findings and consolidated executive briefings.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Model Selection</label>
                    <select
                      value={openAiModel}
                      onChange={(e) => setOpenAiModel(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast & Recommended)</option>
                      <option value="gpt-4o">gpt-4o (Deep Forensic Audit)</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">AI Provider Priority</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="openai">OpenAI (Primary)</option>
                      <option value="gemini">Gemini (Server Built-in)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Test Button */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestOpenAi}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                  <span>Test OpenAI Connection</span>
                </button>
                <span className="text-[11px] text-slate-400">Verifies chat completion probe</span>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: ZOHO BOOKS CONFIGURATION
             ======================================================== */}
          {activeTab === 'zoho' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Zoho Books API Credentials & Data Center</span>
                  <span className="text-[10px] text-slate-500">books.zoho.{zohoDataCenter}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">Zoho Client ID</label>
                    <input
                      type="text"
                      value={zohoClientId}
                      onChange={(e) => setZohoClientId(e.target.value)}
                      placeholder={serverStatus?.zoho.clientId || '1000.xxxxxxxxxxxx'}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Data Center Domain</label>
                    <select
                      value={zohoDataCenter}
                      onChange={(e) => setZohoDataCenter(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                    >
                      <option value="in">India (.in)</option>
                      <option value="com">US / Global (.com)</option>
                      <option value="eu">Europe (.eu)</option>
                      <option value="com.au">Australia (.com.au)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    OAuth Access Token (Global / Fallback)
                  </label>
                  <div className="relative">
                    <input
                      type={showZohoToken ? 'text' : 'password'}
                      value={zohoAccessToken}
                      onChange={(e) => setZohoAccessToken(e.target.value)}
                      placeholder={serverStatus?.zoho.hasToken ? 'Active token configured on server' : '1000.xxxxxxxxx'}
                      className="w-full px-2.5 py-1.5 pr-8 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowZohoToken(!showZohoToken)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showZohoToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Individual clients can also supply their own Org ID and client-specific token in their connection settings.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Test Organization ID (Optional)</label>
                  <input
                    type="text"
                    value={zohoTestOrgId}
                    onChange={(e) => setZohoTestOrgId(e.target.value)}
                    placeholder="e.g. 809214772 (Leave empty to probe active org)"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Zoho Data Pull Info */}
              <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-lg p-3 text-[11px] text-emerald-950 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Paginated Entity Collectors Supported:
                </div>
                <p className="text-emerald-800">
                  Invoices, Purchase Bills, Credit Notes, Vendor Credits, Customer Payments, Vendor Payments, Expenses, and Journals.
                </p>
              </div>

              {/* Test Button */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestZoho}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>Test Zoho Books Connection</span>
                </button>
                <span className="text-[11px] text-slate-400">Pings Zoho Books REST API</span>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: TALLYPRIME CONFIGURATION
             ======================================================== */}
          {activeTab === 'tally' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">TallyPrime XML Gateway Parameters</span>
                  <span className="text-[10px] font-mono text-slate-500">Port 9000 (Default)</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">Tally Host / IP</label>
                    <input
                      type="text"
                      value={tallyHost}
                      onChange={(e) => setTallyHost(e.target.value)}
                      placeholder="localhost or 192.168.1.10"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Port</label>
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
                  <label className="block text-slate-700 font-medium mb-1">Probe Active Company (Optional)</label>
                  <input
                    type="text"
                    value={tallyTestCompany}
                    onChange={(e) => setTallyTestCompany(e.target.value)}
                    placeholder="e.g. Zenith Engineering & Controls Pvt Ltd"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    When provided, the test will confirm that this company is actively opened in TallyPrime.
                  </p>
                </div>
              </div>

              {/* Tally Step-by-Step Guide Accordion */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTallyGuide(!showTallyGuide)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-100 text-left font-medium text-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    How to enable XML Server in TallyPrime
                  </span>
                  {showTallyGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showTallyGuide && (
                  <div className="p-3 text-[11px] text-slate-600 space-y-1.5 bg-white border-t border-slate-200">
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-900">1.</span>
                      <span>In TallyPrime, press <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-300 font-mono">F1</kbd> (Help) &rarr; <strong>Settings</strong> &rarr; <strong>Connectivity</strong>.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-900">2.</span>
                      <span>Under <em>Client/Server configuration</em>, set <strong>TallyPrime acts as</strong> to <strong>Both</strong>.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-900">3.</span>
                      <span>Set <strong>Enable ODBC</strong> to <strong>Yes</strong> and set <strong>Port</strong> to <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">9000</code>.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-900">4.</span>
                      <span>Restart TallyPrime and load your client company. Then click <strong>Test Tally Connection</strong> below.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Test Button */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestTally}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-blue-400" />}
                  <span>Test Tally Connection</span>
                </button>
                <span className="text-[11px] text-slate-400 font-mono">{tallyHost}:{tallyPort}</span>
              </div>
            </div>
          )}

          {/* Test Connection Result Box */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border animate-in fade-in duration-150 ${
                testResult.status === 'SUCCESS'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold mb-1">
                <div className="flex items-center gap-1.5">
                  {testResult.status === 'SUCCESS' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  )}
                  <span>
                    {testResult.status === 'SUCCESS' ? 'Probe Successful' : 'Connection Notice'}
                  </span>
                </div>
                {testResult.latencyMs !== undefined && (
                  <span className="font-mono text-[10px] text-slate-500 font-normal">
                    {testResult.latencyMs}ms
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed">{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <Check className="w-3.5 h-3.5" />
                Settings Saved!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 rounded-lg shadow-xs transition-colors"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save & Apply Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
