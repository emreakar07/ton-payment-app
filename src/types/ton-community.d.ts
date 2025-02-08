declare module '@ton-community/assets-sdk' {
  import { Address, Cell, SendMode } from '@ton/core';

  export interface JettonContent {
    name: string;
    description: string;
    image_data: string;
    symbol: string;
    decimals: number;
    amount: string;
  }

  export interface JettonMintParams {
    to: Address;
    jettonAmount: bigint;
    amount: bigint;
    queryId?: number;
    forwardTonAmount?: bigint;
    forwardPayload?: Cell;
    responseAddress?: Address;
    sendMode?: SendMode;
  }

  export class AssetsSDK {
    static create(config: any): AssetsSDK;
    deployJetton(content: JettonContent, params?: any): Promise<any>;
  }
}

declare module '@ton-community/assets-sdk/dist/utils' {
  export function toBase64(data: string): string;
} 