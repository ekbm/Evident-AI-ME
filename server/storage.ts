// This file is kept for compatibility but the actual storage is handled by server/db.ts
// The Evident app uses SQLite for persistence

export interface IStorage {}

export class MemStorage implements IStorage {
  constructor() {}
}

export const storage = new MemStorage();
