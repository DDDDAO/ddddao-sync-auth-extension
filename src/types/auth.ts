export interface CommonResp {
  success: boolean;
  data: any;
}

export enum EnumPlatform {
  BINANCE = "Binance",
  OKX = "Okx",
  BITGET = "Bitget",
  BYBIT = "Bybit",
}

export interface CookieMetadata {
  [key: string]: any;
}

export interface DDCookie {
  id: number;
  userId: number;
  platform: EnumPlatform;
  value: string;
  createdAt: number;
  updatedAt: number;
  active: boolean;
  metadata: CookieMetadata;
}

export interface AuthMethodsResponse extends CommonResp {
  data: DDCookie[];
}

export interface Session {
  user: {
    id: number;
    email: string;
    name?: string;
  };
}
