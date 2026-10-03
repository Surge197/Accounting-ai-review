import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { Company, Observation } from '../../../shared/connector/protocol';
import type { ConnectorConfig } from './config';
import { boundedText } from './http';

export interface TallyAdapter { inspect(signal?: AbortSignal): Promise<Observation> }
export class MockTallyAdapter implements TallyAdapter {
  constructor(readonly available: boolean, readonly companies: Company[]) {}
  async inspect(): Promise<Observation> {
    return { adapter: 'mock', tallyStatus: 'NOT_AVAILABLE', reason: 'MOCK_MODE', simulatedAvailability: this.available,
      companies: this.available ? this.companies.map(c => ({ ...c })) : [] };
  }
}
// Fixed read-only metadata collection. No remote job may supply XML, a host, a URL or a port.
export const COMPANY_REQUEST = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>ConnectorCompanies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="ConnectorCompanies" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name,GUID</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
export function parseCompanyResponse(xml: string): Company[] {
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Unsafe or malformed XML');
  const doc = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true, processEntities: true }).parse(xml);
  const envelope = doc.ENVELOPE;
  const collection = envelope?.BODY?.DATA?.COLLECTION;
  if (String(envelope?.HEADER?.STATUS) !== '1' || collection === undefined || /<LINEERROR(?:\s|>)/i.test(xml)) throw new Error('Unrecognized Tally collection response');
  const values = collection?.COMPANY === undefined ? [] : Array.isArray(collection.COMPANY) ? collection.COMPANY : [collection.COMPANY];
  if (values.length > 200) throw new Error('Company inventory exceeds foundation limit');
  const seen = new Set<string>();
  return values.map((value: any) => {
    const id = value.GUID, name = value.NAME ?? value['@_NAME'];
    if (typeof id !== 'string' || !id || id.length > 200 || typeof name !== 'string' || !name || name.length > 200 || /[\u0000-\u001f]/.test(id + name) || seen.has(id)) throw new Error('Company requires unique GUID and name');
    seen.add(id); return { id, name };
  });
}
export class LocalTallyAdapter implements TallyAdapter {
  constructor(readonly port: number, readonly timeout = 5000) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid loopback port');
  }
  async inspect(signal?: AbortSignal): Promise<Observation> {
    let received = false;
    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/`, {
        method: 'POST', headers: { 'content-type': 'text/xml; charset=utf-8' }, body: COMPANY_REQUEST, redirect: 'error',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.timeout)]) : AbortSignal.timeout(this.timeout),
      });
      received = true;
      if (!response.ok) { await response.body?.cancel(); throw new Error('Tally HTTP error'); }
      const companies = parseCompanyResponse(await boundedText(response, 1024 * 1024));
      return { adapter: 'local', tallyStatus: 'AVAILABLE', reason: 'OK', companies };
    } catch {
      return { adapter: 'local', tallyStatus: 'NOT_AVAILABLE', reason: received ? 'INVALID_RESPONSE' : 'CONNECTION_FAILED', companies: [] };
    }
  }
}
export function createAdapter(config: ConnectorConfig): TallyAdapter {
  return config.adapter === 'mock' ? new MockTallyAdapter(config.mockAvailable, config.mockCompanies) : new LocalTallyAdapter(config.tallyPort, config.requestTimeoutMs);
}
