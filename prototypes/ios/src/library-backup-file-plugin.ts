import { registerPlugin } from "@capacitor/core";

export interface LibraryBackupFilePlugin {
  save(options: Readonly<{ filename: string; text: string }>): Promise<Readonly<{ uri: string }>>;
}

export const LibraryBackupFile = registerPlugin<LibraryBackupFilePlugin>("LibraryBackupFile");
