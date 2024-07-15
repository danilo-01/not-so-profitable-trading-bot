export interface StockData {
  symbol: string;
  initialPrice: number | null;
  currentPrice: number | null;
  initialTimestamp: Date | null;
  currentTimestamp: Date | null;
}

export interface AlpacaStockQuote {
  ap: number; // Ask price
  as: number; // Ask size
  ax: string; // Ask exchange
  bp: number; // Bid price
  bs: number; // Bid size
  bx: string; // Bid exchange
  c: string[]; // Conditions
  t: string; // Timestamp
  z: string; // Tape
}

export interface AlpacaStockData {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  maintenance_margin_requirement: number;
  shortable: boolean;
  easy_to_borrow: boolean;
  fractionable: boolean;
  attributes: any[]; // Assuming attributes can be an array of any type, adjust if necessary
}
