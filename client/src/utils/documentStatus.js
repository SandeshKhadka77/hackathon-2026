const DAY_MS = 1000 * 60 * 60 * 24;

export const calculateDocStatus = (expiryDate) => {
  if (!expiryDate) {
    return {
      label: 'No expiry set',
      color: 'slate',
      variant: 'neutral',
      diffDays: null,
    };
  }

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return {
      label: 'Invalid date',
      color: 'slate',
      variant: 'neutral',
      diffDays: null,
    };
  }

  const diffDays = Math.ceil((expiry.getTime() - Date.now()) / DAY_MS);

  if (diffDays <= 0) {
    return {
      label: 'Expired',
      color: 'rose',
      variant: 'destructive',
      diffDays,
    };
  }

  if (diffDays <= 30) {
    return {
      label: 'Expiring Soon',
      color: 'amber',
      variant: 'warning',
      diffDays,
    };
  }

  return {
    label: 'Active',
    color: 'emerald',
    variant: 'success',
    diffDays,
  };
};

export const getNepaliFiscalYearFromExpiry = (expiryDate) => {
  const date = expiryDate ? new Date(expiryDate) : new Date();
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  const adYear = date.getFullYear();
  const adMonth = date.getMonth() + 1;

  const fiscalStartBs = adMonth >= 7 ? adYear + 57 : adYear + 55;
  const fiscalEndBs = fiscalStartBs + 1;

  return `${fiscalStartBs}/${String(fiscalEndBs).slice(-2)}`;
};
