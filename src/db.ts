import Dexie, { type Table } from 'dexie';
import type {
    Category,
    CashLedgerEntry,
    Asset,
    MarketAssetData,
    FixedAssetData,
    Liability,
    MonthlySnapshot
} from './types';

export class WealthDatabase extends Dexie {
    categories!: Table<Category>;
    cash_ledger!: Table<CashLedgerEntry>;
    assets!: Table<Asset>;
    market_asset_data!: Table<MarketAssetData>;
    fixed_asset_data!: Table<FixedAssetData>;
    liabilities!: Table<Liability>;
    monthly_snapshots!: Table<MonthlySnapshot>;

    constructor() {
        super('WealthTrackerDB');
        this.version(2).stores({
            categories: 'id, name, type',
            cash_ledger: 'id, type, amount, category_id, related_asset_id, related_liability_id, date, created_at',
            assets: 'id, name, category, subtype, created_at',
            market_asset_data: 'asset_id, total_units, total_invested, avg_cost, current_nav, last_updated, scheme_name, scheme_code, nav_source',
            fixed_asset_data: 'asset_id, principal, interest_rate, start_date',
            liabilities: 'id, name, type, outstanding_balance, interest_rate',
            monthly_snapshots: 'month, total_assets, total_liabilities, net_worth'
        });
    }
}

export const db = new WealthDatabase();

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
    { name: 'Salary', type: 'income', icon_name: 'wallet' },
    { name: 'Freelance', type: 'income', icon_name: 'briefcase' },
    { name: 'Dividend', type: 'income', icon_name: 'trending-up' },
    { name: 'Other Income', type: 'income', icon_name: 'plus' },
    { name: 'Food', type: 'expense', icon_name: 'coffee' },
    { name: 'Transport', type: 'expense', icon_name: 'truck' },
    { name: 'Shopping', type: 'expense', icon_name: 'shopping-bag' },
    { name: 'Bills', type: 'expense', icon_name: 'file-text' },
    { name: 'Rent', type: 'expense', icon_name: 'home' },
    { name: 'Entertainment', type: 'expense', icon_name: 'frown' },
    { name: 'Health', type: 'expense', icon_name: 'heart' },
    { name: 'Other Expense', type: 'expense', icon_name: 'minus' },
];

export async function seedDatabase() {
    const count = await db.categories.count();
    if (count === 0) {
        await db.categories.bulkAdd(DEFAULT_CATEGORIES.map(cat => ({
            ...cat,
            id: `cat_${cat.type}_${cat.name.toLowerCase().replace(/\s+/g, '_')}`
        })));
    }
}
