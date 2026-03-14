/**
 * Wallet: getBalance, debit (idempotent), credit.
 */
export interface WalletStore {
  getBalance(userId: string): number | Promise<number>;
  setBalance(userId: string, amount: number): void | Promise<void>;
  /** Return true if this idempotency key was already used for a debit. */
  isDebitRecorded(userId: string, idempotencyKey: string): boolean | Promise<boolean>;
  recordDebit(userId: string, idempotencyKey: string): void | Promise<void>;
}

const inMemoryStore = (): WalletStore => {
  const balances = new Map<string, number>();
  const debits = new Set<string>();

  return {
    getBalance(userId: string): number {
      return balances.get(userId) ?? 0;
    },
    setBalance(userId: string, amount: number): void {
      balances.set(userId, amount);
    },
    isDebitRecorded(userId: string, idempotencyKey: string): boolean {
      return debits.has(`${userId}:${idempotencyKey}`);
    },
    recordDebit(userId: string, idempotencyKey: string): void {
      debits.add(`${userId}:${idempotencyKey}`);
    },
  };
};

export interface Wallet {
  getBalance(userId: string): Promise<number>;
  debit(userId: string, amount: number, idempotencyKey: string): Promise<void>;
  credit(userId: string, amount: number): Promise<void>;
}

export function createWallet(store: WalletStore = inMemoryStore()): Wallet {
  return {
    async getBalance(userId: string): Promise<number> {
      return await store.getBalance(userId);
    },

    async debit(userId: string, amount: number, idempotencyKey: string): Promise<void> {
      if (amount <= 0) return;
      const recorded = await store.isDebitRecorded(userId, idempotencyKey);
      if (recorded) return;

      const balance = await store.getBalance(userId);
      if (balance < amount) throw new Error("insufficient_balance");
      await store.setBalance(userId, balance - amount);
      await store.recordDebit(userId, idempotencyKey);
    },

    async credit(userId: string, amount: number): Promise<void> {
      if (amount <= 0) return;
      const balance = await store.getBalance(userId);
      await store.setBalance(userId, balance + amount);
    },
  };
}
