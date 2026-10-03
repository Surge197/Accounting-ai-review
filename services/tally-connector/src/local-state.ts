import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, appendFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { JobResult } from '../../../shared/connector/protocol';

export interface Identity { agentId: string; credential: string; backendUrl: string; adapter: 'mock' | 'local'; registered: boolean; pairingToken?: string; tokenExpiresAt?: number }
// LocalMachine allows administrative provisioning before LocalService starts. NTFS ACLs are mandatory.
export function dpapi(input: string, decrypt = false): string {
  if (process.platform !== 'win32') throw new Error('Windows DPAPI required for connector identity');
  const operation = decrypt ? 'Unprotect' : 'Protect';
  const script = `Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::${operation}($bytes,$null,[Security.Cryptography.DataProtectionScope]::LocalMachine); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const child = spawnSync(executable, ['-NoProfile','-NonInteractive','-Command',script], { input, encoding: 'utf8', windowsHide: true, timeout: 15_000 });
  if (child.status !== 0 || child.error || !child.stdout.trim()) throw new Error('Windows credential protection failed');
  return child.stdout.trim();
}
export function saveIdentity(dir: string, identity: Identity) {
  mkdirSync(dir, { recursive: true });
  const encrypted = dpapi(Buffer.from(JSON.stringify(identity)).toString('base64'));
  const target = path.join(dir, 'identity.dpapi');
  writeFileSync(`${target}.tmp`, encrypted, { mode: 0o600, flush: true });
  renameSync(`${target}.tmp`, target);
}
export function loadIdentity(dir: string): Identity | undefined {
  const target = path.join(dir, 'identity.dpapi');
  if (!existsSync(target)) return undefined;
  const raw = JSON.parse(Buffer.from(dpapi(readFileSync(target, 'utf8'), true), 'base64').toString('utf8'));
  if (!raw.agentId || !/^[A-Za-z0-9_-]{43}$/.test(raw.credential) || typeof raw.registered !== 'boolean') throw new Error('Invalid protected identity');
  return raw;
}
export function acquireLock(dir: string) {
  mkdirSync(dir, { recursive: true });
  // An OS-backed SQLite lock releases on crash; there is no stale-PID deletion race.
  const db = new DatabaseSync(path.join(dir, 'agent-lock.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout=0; CREATE TABLE IF NOT EXISTS singleton(id INTEGER PRIMARY KEY); BEGIN EXCLUSIVE;');
  }
  catch (error: any) {
    db.close();
    if ([5,6].includes(error.errcode)) throw new Error('Another connector process is running');
    throw error;
  }
  return () => { db.exec('ROLLBACK'); db.close(); };
}
export class JobJournal {
  private db: DatabaseSync;
  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path.join(dir, 'jobs.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL)');
  }
  get(id: string, fingerprint: string): JobResult | undefined {
    const row = this.db.prepare('SELECT * FROM results WHERE id=?').get(id);
    if (!row) return;
    if (row.fingerprint !== fingerprint) throw new Error('Job identity payload mismatch');
    return JSON.parse(row.result as string);
  }
  put(id: string, fingerprint: string, result: JobResult) {
    this.db.prepare('INSERT OR IGNORE INTO results VALUES(?,?,?,?)').run(id, fingerprint, JSON.stringify(result), Date.now());
    // Backend never redelivers terminal jobs; expired active leases retry within minutes.
    this.db.prepare('DELETE FROM results WHERE created_at<?').run(Date.now() - 30 * 24 * 60 * 60_000);
  }
  close() { this.db.close(); }
}
export class LocalLogger {
  private file: string;
  constructor(dir: string, private maxBytes = 1024 * 1024) { mkdirSync(dir, { recursive: true }); this.file = path.join(dir, 'connector.log'); }
  write(event: string, fields: { jobId?: string; adapter?: string; tallyStatus?: string; reason?: string; code?: string; retryMs?: number; httpStatus?: number } = {}) {
    if (existsSync(this.file) && statSync(this.file).size >= this.maxBytes) {
      for (let i = 4; i >= 1; i--) {
        const source = i === 1 ? this.file : `${this.file}.${i - 1}`;
        const target = `${this.file}.${i}`;
        if (existsSync(target)) unlinkSync(target);
        if (existsSync(source)) renameSync(source, target);
      }
    }
    // Allowlisted structured fields only: never request bodies, XML, tokens, company names or error stacks.
    const { jobId, adapter, tallyStatus, reason, code, retryMs, httpStatus } = fields;
    appendFileSync(this.file, JSON.stringify({ at: new Date().toISOString(), event, jobId, adapter, tallyStatus, reason, code, retryMs, httpStatus }) + '\n', { mode: 0o600 });
  }
}
