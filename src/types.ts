export type TransactionType = 'income' | 'expense' | 'invest' | 'sell' | 'loan_payment' | 'move_to_parking' | 'move_from_parking' | 'move_to_emergency' | 'move_from_emergency';
export type AssetCategory = 'market' | 'fixed';
export type AssetSubtype = 'mutual_fund' | 'share' | 'gold' | 'silver' | 'fd' | 'epf' | 'ppf' | 'bond' | 'other_market' | 'other_fixed';
export type LiabilityType = 'loan' | 'credit_card';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon_name: string;
}

export interface CashLedgerEntry {
  id: string;
  type: TransactionType;
  amount: number;
  category_id?: string;
  related_asset_id?: string;
  related_liability_id?: string;
  date: string;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  subtype: AssetSubtype;
  created_at: string;
}

export interface MarketAssetData {
  asset_id: string;
  total_units: number;
  total_invested: number;
  avg_cost: number;
  current_nav: number;
  last_updated: string;
}

export interface FixedAssetData {
  asset_id: string;
  principal: number;
  interest_rate: number;
  start_date: string;
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  outstanding_balance: number;
  interest_rate: number;
}

export interface MonthlySnapshot {
  month: string; // YYYY-MM
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
}
