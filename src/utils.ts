export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatNumber = (num: number, precision: number = 2) => {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    }).format(num);
};

export const formatSubtype = (subtype: string) => {
    const map: Record<string, string> = {
        mutual_fund: 'Mutual Funds',
        share: 'Equity Shares',
        gold: 'Physical Gold',
        silver: 'Physical Silver',
        fd: 'Fixed Deposits',
        epf: 'EPF',
        ppf: 'PPF',
        bond: 'Bonds',
        other_market: 'Other Market Assets',
        other_fixed: 'Other Fixed Assets',
    };
    return map[subtype] || subtype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
