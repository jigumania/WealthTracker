import { db } from './db';
import type {
    TransactionType,
    CashLedgerEntry,
    Asset,
    MarketAssetData,
    FixedAssetData,
    Liability
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { differenceInDays, parseISO } from 'date-fns';
import { auth } from './firebase';
import { syncToFirestore, deleteFromFirestore, fetchAllFromFirestore } from './services/firestore';

// --------------------------------------------------
// SYNC ENGINE
// --------------------------------------------------

export async function syncEverything(userId: string) {
    const collections = [
        { path: 'categories', table: db.categories, key: 'id' },
        { path: 'cash_ledger', table: db.cash_ledger, key: 'id' },
        { path: 'assets', table: db.assets, key: 'id' },
        { path: 'market_asset_data', table: db.market_asset_data, key: 'asset_id' },
        { path: 'fixed_asset_data', table: db.fixed_asset_data, key: 'asset_id' },
        { path: 'liabilities', table: db.liabilities, key: 'id' },
    ];

    for (const col of collections) {
        // Step 1: Push all local data TO Firestore
        const localData = await col.table.toArray();
        for (const item of localData) {
            await syncToFirestore(userId, col.path, item);
        }

        // Step 2: Pull all cloud data FROM Firestore (includes data from other devices)
        let cloudData = await fetchAllFromFirestore(userId, col.path);

        // Step 3: Deduplicate categories by name (handles legacy UUID duplicates)
        if (col.path === 'categories' && cloudData.length > 0) {
            const seen = new Set<string>();
            const duplicateIds: string[] = [];
            const unique: any[] = [];
            for (const item of cloudData) {
                const name = (item as any).name;
                if (seen.has(name)) {
                    duplicateIds.push((item as any).id || (item as any).asset_id);
                } else {
                    seen.add(name);
                    unique.push(item);
                }
            }
            cloudData = unique;
            // Clean up duplicates from Firestore
            for (const id of duplicateIds) {
                await deleteFromFirestore(userId, col.path, id);
            }
        }

        if (cloudData.length > 0) {
            await col.table.clear();
            await (col.table as any).bulkAdd(cloudData);
        }
    }
}

// --------------------------------------------------
// UTILS & CALCULATIONS
// --------------------------------------------------

export async function getCashBalances() {
    const ledger = await db.cash_ledger.toArray();

    let totalCash = 0;
    let parkingBalance = 0;
    let emergencyBalance = 0;

    ledger.forEach(entry => {
        switch (entry.type) {
            case 'income':
            case 'sell':
                totalCash += entry.amount;
                break;
            case 'expense':
            case 'invest':
            case 'loan_payment':
                totalCash -= entry.amount;
                break;
            case 'move_to_parking':
                parkingBalance += entry.amount;
                break;
            case 'move_from_parking':
                parkingBalance -= entry.amount;
                break;
            case 'move_to_emergency':
                emergencyBalance += entry.amount;
                break;
            case 'move_from_emergency':
                emergencyBalance -= entry.amount;
                break;
        }
    });

    return {
        totalCash,
        parkingBalance,
        emergencyBalance,
        availableCash: totalCash - parkingBalance - emergencyBalance
    };
}

export function calculateAccruedInterest(principal: number, rate: number, startDate: string) {
    const start = parseISO(startDate);
    const now = new Date();
    const days = differenceInDays(now, start);
    const years = days / 365.25;

    // Annual compounding: A = P(1 + r)^t
    // Using continuous-like or simple approximation for fractional years if needed, 
    // but A = P * (1 + r/100)^years is standard annual compounding.
    const currentValue = principal * Math.pow(1 + rate / 100, years);
    return currentValue;
}

// --------------------------------------------------
// LEDGER ENGINE
// --------------------------------------------------

export async function addTransaction(data: {
    type: TransactionType;
    amount: number;
    category_id?: string;
    date: string;
}) {
    const { availableCash, parkingBalance, emergencyBalance } = await getCashBalances();

    // Validations
    if ((data.type === 'expense' || data.type === 'move_to_parking' || data.type === 'move_to_emergency') && data.amount > availableCash) {
        throw new Error('Insufficient available cash');
    }
    if (data.type === 'move_from_parking' && data.amount > parkingBalance) {
        throw new Error('Insufficient parking balance');
    }
    if (data.type === 'move_from_emergency' && data.amount > emergencyBalance) {
        throw new Error('Insufficient emergency balance');
    }

    const entry: CashLedgerEntry = {
        id: uuidv4(),
        ...data,
        created_at: new Date().toISOString()
    };

    await db.cash_ledger.add(entry);

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'cash_ledger', entry);
    }
}

// --------------------------------------------------
// MARKET ASSET ENGINE
// --------------------------------------------------

export async function addAsset(asset: Omit<Asset, 'id' | 'created_at'>, initialData?: {
    mode: 'existing' | 'new';
    units: number;
    amount: number; // For 'new', this is investment. For 'existing', it's total invested.
    nav: number;
}) {
    const assetId = uuidv4();
    const newAsset: Asset = {
        ...asset,
        id: assetId,
        created_at: new Date().toISOString()
    };

    await db.transaction('rw', [db.assets, db.market_asset_data, db.cash_ledger], async () => {
        await db.assets.add(newAsset);

        // Sync Asset to Firestore
        const user = auth.currentUser;
        if (user) {
            await syncToFirestore(user.uid, 'assets', newAsset);
        }

        if (initialData) {
            if (initialData.mode === 'new') {
                await investInAsset(assetId, initialData.amount, initialData.nav);
            } else {
                const marketData: MarketAssetData = {
                    asset_id: assetId,
                    total_units: initialData.units,
                    total_invested: initialData.amount,
                    avg_cost: initialData.units > 0 ? initialData.amount / initialData.units : 0,
                    current_nav: initialData.nav,
                    last_updated: new Date().toISOString()
                };
                await db.market_asset_data.add(marketData);

                // Sync MarketData to Firestore
                if (user) {
                    await syncToFirestore(user.uid, 'market_asset_data', marketData);
                }
            }
        }
    });

    return assetId;
}

export async function investInAsset(assetId: string, amount: number, nav: number) {
    const { availableCash } = await getCashBalances();
    if (amount > availableCash) {
        throw new Error('Insufficient available cash');
    }

    const unitsAdded = amount / nav;

    await db.transaction('rw', [db.market_asset_data, db.cash_ledger], async () => {
        const existing = await db.market_asset_data.get(assetId);

        if (existing) {
            const newTotalUnits = existing.total_units + unitsAdded;
            const newTotalInvested = existing.total_invested + amount;
            const update = {
                total_units: newTotalUnits,
                total_invested: newTotalInvested,
                avg_cost: newTotalUnits > 0 ? newTotalInvested / newTotalUnits : 0,
                current_nav: nav,
                last_updated: new Date().toISOString()
            };
            await db.market_asset_data.update(assetId, update);

            // Sync update to Firestore
            const user = auth.currentUser;
            if (user) {
                await syncToFirestore(user.uid, 'market_asset_data', { asset_id: assetId, ...update });
            }
        } else {
            const marketData = {
                asset_id: assetId,
                total_units: unitsAdded,
                total_invested: amount,
                avg_cost: nav,
                current_nav: nav,
                last_updated: new Date().toISOString()
            };
            await db.market_asset_data.add(marketData);

            // Sync to Firestore
            const user = auth.currentUser;
            if (user) {
                await syncToFirestore(user.uid, 'market_asset_data', marketData);
            }
        }

        const ledgerEntry: CashLedgerEntry = {
            id: uuidv4(),
            type: 'invest',
            amount,
            related_asset_id: assetId,
            date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };
        await db.cash_ledger.add(ledgerEntry);

        // Sync ledger to Firestore
        const user = auth.currentUser;
        if (user) {
            await syncToFirestore(user.uid, 'cash_ledger', ledgerEntry);
        }
    });
}

export async function sellAsset(assetId: string, unitsToSell: number, sellNav: number) {
    const existing = await db.market_asset_data.get(assetId);
    if (!existing || unitsToSell > existing.total_units) {
        throw new Error('Insufficient units to sell');
    }

    const sellAmount = unitsToSell * sellNav;
    const remainingUnits = existing.total_units - unitsToSell;
    const remainingInvested = existing.avg_cost * remainingUnits;

    await db.transaction('rw', [db.market_asset_data, db.cash_ledger], async () => {
        const update = remainingUnits === 0 ? {
            total_units: 0,
            total_invested: 0,
            avg_cost: 0,
            current_nav: sellNav,
            last_updated: new Date().toISOString()
        } : {
            total_units: remainingUnits,
            total_invested: remainingInvested,
            current_nav: sellNav,
            last_updated: new Date().toISOString()
        };

        await db.market_asset_data.update(assetId, update);

        // Sync MarketData update to Firestore
        const user = auth.currentUser;
        if (user) {
            await syncToFirestore(user.uid, 'market_asset_data', { asset_id: assetId, ...update });
        }

        const ledgerEntry: CashLedgerEntry = {
            id: uuidv4(),
            type: 'sell',
            amount: sellAmount,
            related_asset_id: assetId,
            date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };
        await db.cash_ledger.add(ledgerEntry);

        // Sync Ledger to Firestore
        if (user) {
            await syncToFirestore(user.uid, 'cash_ledger', ledgerEntry);
        }
    });
}

export async function updateNAV(assetId: string, nav: number) {
    const update = {
        current_nav: nav,
        last_updated: new Date().toISOString()
    };
    await db.market_asset_data.update(assetId, update);

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'market_asset_data', { asset_id: assetId, ...update });
    }
}

// --------------------------------------------------
// FIXED ASSET ENGINE
// --------------------------------------------------

export async function addFixedAsset(asset: Omit<Asset, 'id' | 'created_at'>, data: Omit<FixedAssetData, 'asset_id'>) {
    const assetId = uuidv4();
    const newAsset = {
        ...asset,
        id: assetId,
        created_at: new Date().toISOString()
    };
    const fixedData = {
        asset_id: assetId,
        ...data
    };

    await db.transaction('rw', [db.assets, db.fixed_asset_data], async () => {
        await db.assets.add(newAsset);
        await db.fixed_asset_data.add(fixedData);

        // Sync to Firestore
        const user = auth.currentUser;
        if (user) {
            await syncToFirestore(user.uid, 'assets', newAsset);
            await syncToFirestore(user.uid, 'fixed_asset_data', fixedData);
        }
    });
}

// --------------------------------------------------
// LIABILITY ENGINE
// --------------------------------------------------

export async function addLiability(liability: Omit<Liability, 'id'>) {
    const newLiability = {
        ...liability,
        id: uuidv4()
    };
    await db.liabilities.add(newLiability);

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'liabilities', newLiability);
    }
}

export async function makeLiabilityPayment(liabilityId: string, amount: number) {
    const { availableCash } = await getCashBalances();
    const liability = await db.liabilities.get(liabilityId);

    if (!liability || amount > liability.outstanding_balance) {
        throw new Error('Cannot overpay liability');
    }
    if (amount > availableCash) {
        throw new Error('Insufficient available cash');
    }

    await db.transaction('rw', [db.liabilities, db.cash_ledger], async () => {
        const newBalance = liability.outstanding_balance - amount;
        await db.liabilities.update(liabilityId, {
            outstanding_balance: newBalance
        });

        // Sync Liability update to Firestore
        const user = auth.currentUser;
        if (user) {
            await syncToFirestore(user.uid, 'liabilities', { id: liabilityId, outstanding_balance: newBalance });
        }

        const ledgerEntry: CashLedgerEntry = {
            id: uuidv4(),
            type: 'loan_payment',
            amount,
            related_liability_id: liabilityId,
            date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };
        await db.cash_ledger.add(ledgerEntry);

        // Sync Ledger to Firestore
        if (user) {
            await syncToFirestore(user.uid, 'cash_ledger', ledgerEntry);
        }
    });
}

// --------------------------------------------------
// SNAPSHOT SYSTEM
// --------------------------------------------------

export async function createMonthlySnapshot() {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    const { totalCash } = await getCashBalances();
    const marketData = await db.market_asset_data.toArray();
    const fixedData = await db.fixed_asset_data.toArray();
    const liabilities = await db.liabilities.toArray();

    let totalAssets = totalCash;
    marketData.forEach(d => {
        totalAssets += d.total_units * d.current_nav;
    });
    fixedData.forEach(d => {
        totalAssets += calculateAccruedInterest(d.principal, d.interest_rate, d.start_date);
    });

    let totalLiabilities = 0;
    liabilities.forEach(l => {
        totalLiabilities += l.outstanding_balance;
    });

    const netWorth = totalAssets - totalLiabilities;

    await db.monthly_snapshots.put({
        month,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_worth: netWorth
    });
}
// --------------------------------------------------
// MANAGEMENT (DELETE/UPDATE)
// --------------------------------------------------

export async function deleteAsset(assetId: string) {
    await db.transaction('rw', [db.assets, db.market_asset_data, db.fixed_asset_data, db.cash_ledger], async () => {
        await db.assets.delete(assetId);
        await db.market_asset_data.delete(assetId);
        await db.fixed_asset_data.delete(assetId);

        // Sync Delete to Firestore
        const user = auth.currentUser;
        if (user) {
            await deleteFromFirestore(user.uid, 'assets', assetId);
            await deleteFromFirestore(user.uid, 'market_asset_data', assetId);
            await deleteFromFirestore(user.uid, 'fixed_asset_data', assetId);
        }
    });
}

export async function updateAssetBasic(assetId: string, name: string) {
    await db.assets.update(assetId, { name });

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'assets', { id: assetId, name });
    }
}

export async function updateMarketAssetDetails(assetId: string, data: Partial<MarketAssetData>) {
    const update = {
        ...data,
        last_updated: new Date().toISOString()
    };
    await db.market_asset_data.update(assetId, update);

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'market_asset_data', { asset_id: assetId, ...update });
    }
}

export async function updateFixedAssetDetails(assetId: string, data: Partial<FixedAssetData>) {
    await db.fixed_asset_data.update(assetId, data);

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'fixed_asset_data', { asset_id: assetId, ...data });
    }
}

export async function deleteTransaction(transactionId: string) {
    await db.cash_ledger.delete(transactionId);

    // Sync delete to Firestore
    const user = auth.currentUser;
    if (user) {
        await deleteFromFirestore(user.uid, 'cash_ledger', transactionId);
    }
}

export async function updateTransaction(transactionId: string, data: {
    amount: number;
    category_id?: string;
    date: string;
}) {
    const existing = await db.cash_ledger.get(transactionId);
    if (!existing) throw new Error('Transaction not found');

    // If it's an expense or move, we might need to validate cash again, 
    // but updating is simpler if we assume the user knows what they're doing for local-first.
    // However, let's keep it safe.
    if (existing.type === 'expense' || existing.type === 'move_to_parking') {
        const { availableCash } = await getCashBalances();
        const diff = data.amount - existing.amount;
        if (diff > availableCash) {
            throw new Error('Insufficient available cash for this update');
        }
    }

    await db.cash_ledger.update(transactionId, data);

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'cash_ledger', { id: transactionId, ...data });
    }
}

export async function deleteLiability(liabilityId: string) {
    await db.liabilities.delete(liabilityId);

    // Sync delete to Firestore
    const user = auth.currentUser;
    if (user) {
        await deleteFromFirestore(user.uid, 'liabilities', liabilityId);
    }
}

export async function updateLiability(liabilityId: string, data: Partial<Liability>) {
    await db.liabilities.update(liabilityId, data);

    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
        await syncToFirestore(user.uid, 'liabilities', { id: liabilityId, ...data });
    }
}
