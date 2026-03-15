declare global {
  namespace App {
    interface Locals {
      user?: { uid: string; email?: string | null };
    }
    interface PageData {
      user?: { uid: string; email?: string | null };
    }
    // interface Error {}
    // interface Platform {}
  }
}

export {};
