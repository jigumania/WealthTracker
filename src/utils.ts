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
