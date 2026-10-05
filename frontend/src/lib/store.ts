import type { StoredReport } from "./types";

// Reports live in the visitor's own browser. Nothing is kept on the server.
const DB = "sift";
const STORE = "reports";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("createdAt", "createdAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function saveReport(report: StoredReport) {
  return run("readwrite", (s) => s.put(report));
}

export function getReport(id: string) {
  return run<StoredReport | undefined>("readonly", (s) => s.get(id));
}

export async function listReports(): Promise<StoredReport[]> {
  const all = await run<StoredReport[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteReport(id: string) {
  return run("readwrite", (s) => s.delete(id));
}

export function renameReport(report: StoredReport, name: string) {
  return saveReport({ ...report, name });
}
