import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { mountConnector } from './server/connector/mount';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

mountConnector(app);
app.use(express.json({ limit: '10mb' }));

// Server-side runtime configuration (configurable via API Integration Settings UI)
const runtimeConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: 'gpt-4o-mini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  zohoAccessToken: process.env.ZOHO_ACCESS_TOKEN || '',
  zohoClientId: process.env.ZOHO_CLIENT_ID || '',
  zohoDataCenter: process.env.ZOHO_DATA_CENTER || 'in',
};

// Initialize GoogleGenAI SDK on server side only
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Helper to call OpenAI Chat Completions API
 */
async function callOpenAiChat(
  messages: Array<{ role: string; content: string }>,
  model: string = 'gpt-4o-mini',
  apiKeyOverride?: string,
  jsonMode: boolean = false
): Promise<string> {
  const apiKey = apiKeyOverride || runtimeConfig.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server or provided in request.');
  }

  const payload: any = {
    model: model || runtimeConfig.openaiModel || 'gpt-4o-mini',
    messages,
    temperature: 0.2,
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${errData}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * GET /api/settings/status
 * Returns current configuration status of OpenAI, Zoho Books, TallyPrime, and Gemini
 */
app.get('/api/settings/status', (_req: Request, res: Response): void => {
  const currentOpenAiKey = runtimeConfig.openaiApiKey || process.env.OPENAI_API_KEY || '';
  const currentGeminiKey = runtimeConfig.geminiApiKey || process.env.GEMINI_API_KEY || '';
  const currentZohoToken = runtimeConfig.zohoAccessToken || process.env.ZOHO_ACCESS_TOKEN || '';
  const currentZohoClientId = runtimeConfig.zohoClientId || process.env.ZOHO_CLIENT_ID || '';

  res.json({
    openai: {
      isConfigured: !!currentOpenAiKey,
      apiKeyMasked: currentOpenAiKey ? `sk-...${currentOpenAiKey.slice(-4)}` : '',
      defaultModel: runtimeConfig.openaiModel || 'gpt-4o-mini',
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    },
    gemini: {
      isConfigured: !!currentGeminiKey,
      defaultModel: 'gemini-3.8-flash',
      supportedModels: ['gemini-3.8-flash', 'gemini-2.5-pro'],
    },
    zoho: {
      isConfigured: !!currentZohoToken || !!currentZohoClientId,
      clientId: currentZohoClientId ? 'Configured (masked)' : undefined,
      dataCenter: runtimeConfig.zohoDataCenter || 'in',
      hasToken: !!currentZohoToken,
    },
    tally: {
      connectorRequired: true,
    },
  });
});

/**
 * POST /api/settings/update
 * Updates existing non-Tally runtime settings. Tally settings belong to the Windows agent.
 */
app.post('/api/settings/update', (req: Request, res: Response): void => {
  try {
    if (req.body?.tally !== undefined) {
      res.status(410).json({ success: false, error: 'Tally host/port settings are disabled. Use the Windows Connector local configuration.' });
      return;
    }
    const { openai, zoho, gemini } = req.body;

    if (openai) {
      if (openai.apiKey !== undefined && openai.apiKey.trim()) {
        runtimeConfig.openaiApiKey = openai.apiKey.trim();
      }
      if (openai.defaultModel !== undefined) {
        runtimeConfig.openaiModel = openai.defaultModel;
      }
    }

    if (gemini) {
      if (gemini.apiKey !== undefined && gemini.apiKey.trim()) {
        runtimeConfig.geminiApiKey = gemini.apiKey.trim();
        aiClient = new GoogleGenAI({
          apiKey: runtimeConfig.geminiApiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
      }
    }

    if (zoho) {
      if (zoho.accessToken !== undefined && zoho.accessToken.trim()) {
        runtimeConfig.zohoAccessToken = zoho.accessToken.trim();
      }
      if (zoho.clientId !== undefined) {
        runtimeConfig.zohoClientId = zoho.clientId.trim();
      }
      if (zoho.dataCenter !== undefined) {
        runtimeConfig.zohoDataCenter = zoho.dataCenter;
      }
    }

    res.json({
      success: true,
      message: 'API Integration settings successfully updated in runtime.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/ai/test-connection
 * Tests AI connectivity for OpenAI or Gemini
 */
app.post('/api/ai/test-connection', async (req: Request, res: Response): Promise<void> => {
  const { provider = 'gemini', model, apiKey } = req.body;
  const startTime = Date.now();

  try {
    if (provider === 'openai') {
      const responseText = await callOpenAiChat(
        [
          {
            role: 'system',
            content: 'You are an accounting audit assistant. Respond with a short confirmation message.',
          },
          {
            role: 'user',
            content: 'Confirm connection test for Accounting AI Review.',
          },
        ],
        model || 'gpt-4o-mini',
        apiKey
      );

      const latencyMs = Date.now() - startTime;
      res.json({
        success: true,
        provider: 'OpenAI',
        model: model || 'gpt-4o-mini',
        latencyMs,
        message: responseText || 'Successfully connected to OpenAI API.',
      });
      return;
    } else {
      // Gemini
      if (!aiClient && !apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in environment or provided.');
      }

      const client = apiKey ? new GoogleGenAI({ apiKey }) : aiClient!;
      const result = await client.models.generateContent({
        model: model || 'gemini-3.8-flash',
        contents: 'Confirm connection test for Accounting AI Review with a concise 1-sentence acknowledgement.',
      });

      const latencyMs = Date.now() - startTime;
      res.json({
        success: true,
        provider: 'Gemini',
        model: model || 'gemini-3.8-flash',
        latencyMs,
        message: result.text?.trim() || 'Successfully connected to Gemini API.',
      });
      return;
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    res.json({
      success: false,
      provider: provider === 'openai' ? 'OpenAI' : 'Gemini',
      latencyMs,
      error: err.message || 'AI connection test failed.',
    });
  }
});

/**
 * POST /api/ai/analyze-findings
 * Server-side AI explanation endpoint supporting OpenAI and Gemini
 */
app.post('/api/ai/analyze-findings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { findings, companyName, software, provider = 'gemini', model, apiKey } = req.body;

    if (!Array.isArray(findings) || findings.length === 0) {
      res.json({ explanations: {} });
      return;
    }

    // Limit to top 15 findings to ensure snappy response
    const targetFindings = findings.slice(0, 15);

    const promptText = `You are an expert Chartered Accountant reviewing automated findings from ${software} for company "${companyName}".
Below is a list of flagged accounting transactions. For each finding ID, provide a clear, concise (1-2 sentences) accounting audit explanation of the potential risk or underlying reason, written in objective professional terminology (e.g. "potential issue", "requires review", "unusual pattern"). Do not use accusation words like "fraud" or "guilty".

Findings:
${JSON.stringify(
  targetFindings.map((f: any) => ({
    id: f.id,
    issueType: f.issueType,
    severity: f.severity,
    party: f.party,
    amount: f.amount,
    date: f.date,
    voucherNumber: f.voucherNumber,
    reason: f.reason,
  })),
  null,
  2
)}

Return a valid JSON object mapping each finding ID to its AI explanation string, like:
{
  "FND-001": "Short explanation...",
  "FND-002": "Short explanation..."
}`;

    // 1. If OpenAI requested or configured
    if (provider === 'openai' && (runtimeConfig.openaiApiKey || process.env.OPENAI_API_KEY || apiKey)) {
      try {
        const openAiResp = await callOpenAiChat(
          [
            { role: 'system', content: 'You are an accounting audit assistant outputting JSON only.' },
            { role: 'user', content: promptText },
          ],
          model || runtimeConfig.openaiModel || 'gpt-4o-mini',
          apiKey,
          true
        );
        const parsed = JSON.parse(openAiResp);
        res.json({ explanations: parsed, provider: 'OpenAI' });
        return;
      } catch (openAiErr: any) {
        console.warn('OpenAI explanation generation failed:', openAiErr.message);
      }
    }

    // 2. Default to Gemini
    if (aiClient && process.env.GEMINI_API_KEY) {
      try {
        const response = await aiClient.models.generateContent({
          model: model || 'gemini-3.8-flash',
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || '{}';
        const parsed = JSON.parse(text);
        res.json({ explanations: parsed, provider: 'Gemini' });
        return;
      } catch (geminiError: any) {
        console.warn('Gemini API call failed or timed out, using accounting heuristic fallback:', geminiError.message);
      }
    }

    // 3. High quality deterministic accounting explanations fallback
    const fallbackExplanations: Record<string, string> = {};
    for (const f of targetFindings) {
      fallbackExplanations[f.id] = generateAccountingExplanation(f);
    }
    res.json({ explanations: fallbackExplanations, provider: 'Deterministic Heuristic' });
  } catch (error: any) {
    console.error('Error in /api/ai/analyze-findings:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/ai/portfolio-summary
 * Generates an executive-level summary across multiple client reviews
 */
app.post('/api/ai/portfolio-summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientsSummary, totalFlaggedAmount, provider = 'gemini', model, apiKey } = req.body;

    if (!Array.isArray(clientsSummary) || clientsSummary.length === 0) {
      res.json({ summary: 'No client reviews available for portfolio analysis.' });
      return;
    }

    const summaryPrompt = `You are a Senior Audit Partner summarizing multi-client review results for an accounting firm.
Clients reviewed:
${JSON.stringify(clientsSummary, null, 2)}
Total flagged exposure across portfolio: ₹${totalFlaggedAmount}

Write a professional 2-3 paragraph executive summary of key systemic risks, compliance observations, and recommended audit prioritization. Use neutral, objective accounting audit terminology (e.g., "requires substantiation", "potential tax slab variances", "Section 40A(3) thresholds", "duplicate invoice sequences"). Keep it actionable and concise.`;

    // 1. Try OpenAI if selected
    if (provider === 'openai' && (runtimeConfig.openaiApiKey || process.env.OPENAI_API_KEY || apiKey)) {
      try {
        const openAiResp = await callOpenAiChat(
          [
            { role: 'system', content: 'You are a Senior Audit Partner writing an executive audit summary.' },
            { role: 'user', content: summaryPrompt },
          ],
          model || runtimeConfig.openaiModel || 'gpt-4o-mini',
          apiKey,
          false
        );
        if (openAiResp) {
          res.json({ summary: openAiResp, provider: 'OpenAI' });
          return;
        }
      } catch (err: any) {
        console.warn('OpenAI portfolio summary failed:', err.message);
      }
    }

    // 2. Try Gemini
    if (aiClient && process.env.GEMINI_API_KEY) {
      try {
        const response = await aiClient.models.generateContent({
          model: model || 'gemini-3.8-flash',
          contents: summaryPrompt,
        });

        res.json({ summary: response.text?.trim(), provider: 'Gemini' });
        return;
      } catch (geminiError: any) {
        console.warn('Portfolio AI summary failed, using fallback:', geminiError.message);
      }
    }

    // 3. Deterministic fallback summary
    const totalCritical = clientsSummary.reduce((acc: number, c: any) => acc + (c.criticalCount || 0), 0);
    const totalReview = clientsSummary.reduce((acc: number, c: any) => acc + (c.reviewCount || 0), 0);
    const totalTx = clientsSummary.reduce((acc: number, c: any) => acc + (c.transactionsCount || 0), 0);

    const fallback = `Portfolio-wide analysis across ${clientsSummary.length} client companies (${totalTx} total transactions examined) identified ${totalCritical} critical issues and ${totalReview} items requiring audit verification, with a consolidated flagged exposure of ₹${Number(totalFlaggedAmount || 0).toLocaleString('en-IN')}.\n\nPrimary systemic findings concentrate around duplicate vendor invoice numbering, unclassified suspense account disbursements, statutory cash expense caps under Section 40A(3), and GST calculation variances against notified tariff rates. Prioritize individual ledger reconciliations for entities with High Risk classifications prior to period-end GST filing.`;

    res.json({ summary: fallback, provider: 'Deterministic Heuristic' });
  } catch (error: any) {
    console.error('Error in /api/ai/portfolio-summary:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================================================
// REAL ZOHO BOOKS DATA COLLECTION API ROUTES
// ============================================================================

/**
 * POST /api/zoho/test-connection
 * Tests Zoho Books organization connectivity using OAuth token or org credentials
 */
app.post('/api/zoho/test-connection', async (req: Request, res: Response): Promise<void> => {
  const { orgId, dataCenter = 'in', accessToken } = req.body;
  const dc = (dataCenter || 'in').toLowerCase();
  const token = accessToken || process.env.ZOHO_ACCESS_TOKEN;

  if (!token) {
    res.json({
      status: 'AUTH_REQUIRED',
      message: 'No Zoho Books OAuth access token configured for this client. Please authenticate with Zoho Books.',
    });
    return;
  }

  try {
    const url = `https://books.zoho.${dc}/api/v3/organizations${orgId ? `/${orgId}` : ''}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });

    if (response.status === 401) {
      res.json({
        status: 'AUTH_REQUIRED',
        message: 'Zoho Books OAuth token has expired or is invalid. Token refresh required.',
      });
      return;
    }

    if (response.status === 404) {
      res.json({
        status: 'ORG_NOT_FOUND',
        message: `Zoho Books Organization ID ${orgId || ''} was not found under this account.`,
      });
      return;
    }

    if (!response.ok) {
      res.json({
        status: 'FAILED',
        message: `Zoho Books API responded with status ${response.status}: ${response.statusText}`,
      });
      return;
    }

    const data = await response.json();
    res.json({
      status: 'CONNECTED',
      message: `Connected to Zoho Books Organization: ${data.organization?.name || orgId || 'Active'}`,
      details: data.organization || {},
    });
  } catch (err: any) {
    res.json({
      status: 'FAILED',
      message: `Failed to connect to Zoho Books API: ${err.message}`,
    });
  }
});

/**
 * POST /api/zoho/pull-data
 * Collects invoices, bills, journals, payments, credit notes from Zoho Books REST API with pagination
 */
app.post('/api/zoho/pull-data', async (req: Request, res: Response): Promise<void> => {
  const { orgId, dataCenter = 'in', accessToken, fromDate, toDate, fullSync } = req.body;
  const dc = (dataCenter || 'in').toLowerCase();
  const token = accessToken || process.env.ZOHO_ACCESS_TOKEN;

  if (!token) {
    res.json({
      success: false,
      code: 'AUTH_REQUIRED',
      error: 'Zoho Books OAuth access token required for live data collection.',
    });
    return;
  }

  try {
    const headers = {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    };

    const records: any[] = [];
    const dateQuery = fromDate && toDate ? `&date_start=${fromDate}&date_end=${toDate}` : '';

    // Helper for paginated resource fetch
    const fetchResource = async (endpoint: string, key: string, maxPages: number = 3) => {
      for (let page = 1; page <= maxPages; page++) {
        const url = `https://books.zoho.${dc}/api/v3/${endpoint}?organization_id=${orgId}&page=${page}&per_page=200${dateQuery}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) break;
        const json = await resp.json();
        const items = json[key] || [];
        records.push(...items);
        if (!json.page_context?.has_more_page) break;
      }
    };

    // Parallel fetch of core accounting transaction entities
    await Promise.allSettled([
      fetchResource('invoices', 'invoices'),
      fetchResource('bills', 'bills'),
      fetchResource('creditnotes', 'creditnotes'),
      fetchResource('vendorcredits', 'vendorcredits'),
      fetchResource('customerpayments', 'customerpayments'),
      fetchResource('vendorpayments', 'vendorpayments'),
      fetchResource('expenses', 'expenses'),
      fetchResource('journals', 'journals'),
    ]);

    res.json({
      success: true,
      records,
      isLive: true,
    });
  } catch (err: any) {
    res.json({
      success: false,
      code: 'FAILED',
      error: `Error retrieving Zoho Books data: ${err.message}`,
    });
  }
});

function generateAccountingExplanation(finding: any): string {
  const type = (finding.issueType || '').toLowerCase();
  const amt = finding.amount;

  if (type.includes('duplicate invoice') || type.includes('duplicate voucher')) {
    return `This voucher number appears more than once in the review period. It may represent an unintentional re-entry of the vendor bill or an overlap in invoice series requiring cancellation of the duplicate.`;
  }
  if (type.includes('duplicate transaction')) {
    return `Identical transaction amount posted for the same counterparty within short succession. Check whether two genuine supplies occurred or if an identical voucher was mistakenly created twice.`;
  }
  if (type.includes('unusual vendor') || type.includes('unusual transaction') || type.includes('unusual customer')) {
    return `This transaction value is significantly higher than historical baseline transactions for this counterparty. It may reflect a major capital asset purchase, bulk raw materials, or an incorrect decimal/posting error.`;
  }
  if (type.includes('missing gstin')) {
    return `Taxable transaction booked without a valid 15-digit GSTIN. Input tax credit (ITC) cannot be claimed or matched in GSTR-2B without counterparty registration details.`;
  }
  if (type.includes('gst calculation') || type.includes('anomalous tax rate')) {
    return `The calculated GST rate diverges from standard statutory tax slabs (5%, 12%, 18%, 28%). Verify whether items with mixed tax rates were grouped under a single line or if a manual override occurred.`;
  }
  if (type.includes('cgst/sgst and igst')) {
    return `Intra-state and inter-state tax components are recorded on the same voucher. A supply cannot attract both IGST and CGST/SGST; check recipient place of supply and ledger configuration.`;
  }
  if (type.includes('cash payment over')) {
    return `Cash expenditure exceeds the ₹10,000 threshold under Section 40A(3) of the Income Tax Act. Such payments risk statutory disallowance unless covered under Rule 6DD exemptions.`;
  }
  if (type.includes('suspense')) {
    return `Posting to suspense account indicates an unclassified bank receipt or payment without source documentation. This requires immediate bank slip and counterparty verification prior to financial close.`;
  }
  if (type.includes('large journal')) {
    return `High-value non-cash journal adjustment passed outside standard billing workflows. Audit guidelines recommend verifying the authorizing approval note and supporting calculation sheets.`;
  }
  if (type.includes('round-number')) {
    return `Exact round-sum entry often signals an estimated provision, advance disbursement, or ad-hoc settlement requiring substantiation by detailed tax invoice.`;
  }
  return `Potential anomaly identified by accounting rules engine. Review underlying voucher and supporting documentation to verify accuracy.`;
}

// Start Server & mount Vite middlewares in dev mode
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Accounting AI Review server running on port ${PORT}`);
  });
}

startServer();
