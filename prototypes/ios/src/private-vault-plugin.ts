import { registerPlugin } from '@capacitor/core';

export interface NativeAccountPlugin {
  status(): Promise<unknown>;
  signIn(): Promise<unknown>;
  verifySession(): Promise<unknown>;
  signOut(): Promise<unknown>;
}

export interface NativePrivateVaultPlugin {
  status(): Promise<unknown>;
  stageBegin(options: { uid: string; epoch: number; bytes: number; sha256: string }): Promise<unknown>;
  stageChunk(options: { uid: string; epoch: number; id: string; offset: number; base64: string }): Promise<unknown>;
  stageSeal(options: { uid: string; epoch: number; id: string }): Promise<unknown>;
  stageAbort(options: { uid: string; epoch: number; id: string }): Promise<unknown>;
  list(options: { uid: string; epoch: number }): Promise<unknown>;
  upload(options: {
    uid: string; epoch: number; slot: string; id: string; bytes: number; sha256: string;
  }): Promise<unknown>;
  download(options: {
    uid: string; epoch: number; slot: string; generation: string; bytes: number; sha256: string;
  }): Promise<unknown>;
  downloadChunk(options: { uid: string; epoch: number; id: string; offset: number }): Promise<unknown>;
  downloadFinish(options: { uid: string; epoch: number; id: string }): Promise<unknown>;
  discard(options: { uid: string; epoch: number; id: string }): Promise<unknown>;
  retainStaged(options: { uid: string; epoch: number; ids: readonly string[] }): Promise<unknown>;
}

export interface NativeVaultBridges {
  readonly account: NativeAccountPlugin;
  readonly vault: NativePrivateVaultPlugin;
}

export const nativeVaultBridges: NativeVaultBridges = Object.freeze({
  account: registerPlugin<NativeAccountPlugin>('NativeAccount'),
  vault: registerPlugin<NativePrivateVaultPlugin>('PrivateVault'),
});
