import React from 'react';
import { Sparkles, FileText, Check, Copy } from 'lucide-react';

interface ExecutiveAiSummaryCardProps {
  summary?: string;
  totalClients: number;
}

export const ExecutiveAiSummaryCard: React.FC<ExecutiveAiSummaryCardProps> = ({
  summary,
  totalClients,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!summary) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-xs border border-indigo-900/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wide uppercase text-indigo-200">
              AI Multi-Client Executive Briefing
            </h4>
            <p className="text-[11px] text-slate-400">
              Cross-client audit synthesis across {totalClients} connected companies
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-slate-200 transition-colors"
          title="Copy executive summary"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="text-xs text-slate-200 leading-relaxed font-normal whitespace-pre-line bg-black/20 p-3.5 rounded-lg border border-white/5">
        {summary}
      </div>

      <div className="text-[11px] text-indigo-300/70 flex items-center justify-between pt-1">
        <span>Powered by Gemini Server-Side Accounting Audit Models</span>
        <span className="italic">Confidential Partner Review Briefing</span>
      </div>
    </div>
  );
};
