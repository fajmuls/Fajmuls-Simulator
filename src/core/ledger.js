import { LEDGER_KEEP } from './catalog.js';

// Buku kas: semua uang bilangan bulat (Rupiah). Setiap perubahan saldo
// WAJIB lewat credit()/debit() sehingga saldo selalu = pembukaan + arsip + jumlah catatan.

function assertAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Jumlah uang harus bilangan bulat positif, diterima: ${amount}`);
  }
}

export function createLedger(opening) {
  if (!Number.isSafeInteger(opening) || opening < 0) throw new Error('Saldo awal tidak valid');
  return { opening, archived: 0, balance: opening, entries: [], nextId: 1 };
}

function push(ledger, day, type, signed, desc) {
  ledger.balance += signed;
  ledger.entries.push({
    id: ledger.nextId++,
    day,
    type,
    amount: signed,
    desc,
    balanceAfter: ledger.balance,
  });
  if (ledger.entries.length > LEDGER_KEEP + 100) {
    const drop = ledger.entries.splice(0, ledger.entries.length - LEDGER_KEEP);
    ledger.archived += drop.reduce((s, e) => s + e.amount, 0);
  }
}

export function credit(ledger, day, type, amount, desc) {
  assertAmount(amount);
  push(ledger, day, type, amount, desc);
}

export function canAfford(ledger, amount) {
  return Number.isSafeInteger(amount) && amount >= 0 && ledger.balance >= amount;
}

export function debit(ledger, day, type, amount, desc) {
  assertAmount(amount);
  if (ledger.balance < amount) {
    throw new Error('Uang tidak cukup');
  }
  push(ledger, day, type, -amount, desc);
}

// Memeriksa kebenaran buku kas. Mengembalikan daftar masalah (kosong = sehat).
export function auditLedger(ledger) {
  const problems = [];
  if (!Number.isSafeInteger(ledger.balance) || ledger.balance < 0) problems.push('Saldo negatif atau bukan bilangan bulat');
  const sum = ledger.entries.reduce((s, e) => s + e.amount, 0);
  if (ledger.opening + ledger.archived + sum !== ledger.balance) {
    problems.push('Saldo tidak sama dengan pembukaan + arsip + jumlah transaksi');
  }
  let running = ledger.opening + ledger.archived;
  for (const e of ledger.entries) {
    running += e.amount;
    if (!Number.isSafeInteger(e.amount) || e.amount === 0) problems.push(`Catatan ${e.id}: jumlah tidak valid`);
    if (e.balanceAfter !== running) {
      problems.push(`Catatan ${e.id}: saldo sesudah tidak konsisten`);
      break;
    }
  }
  return problems;
}

export function sumByType(ledger, day) {
  const out = {};
  for (const e of ledger.entries) {
    if (e.day !== day) continue;
    out[e.type] = (out[e.type] || 0) + e.amount;
  }
  return out;
}
