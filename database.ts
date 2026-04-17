import { DonationData, Donor, OrgData } from './types';

const STORAGE_KEYS = {
  RECEIPTS: 'app_receipts',
  DONORS: 'app_donors',
  ORG_DATA: 'app_org_data',
  LAST_RECEIPT_NUMBER: 'app_last_receipt_number'
};

/**
 * Initializes the database. For localStorage, this just ensures the keys exist.
 */
export const initDB = async () => {
  console.info('[DB] Initializing localStorage database...');
  
  if (!localStorage.getItem(STORAGE_KEYS.RECEIPTS)) {
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.DONORS)) {
    localStorage.setItem(STORAGE_KEYS.DONORS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LAST_RECEIPT_NUMBER)) {
    localStorage.setItem(STORAGE_KEYS.LAST_RECEIPT_NUMBER, '1000');
  }
  
  // Migrate from old keys if they exist (from previous versions if any)
  migrateFromOldKeys();

  console.info('[DB] Database initialized successfully.');
};

const migrateFromOldKeys = () => {
    // Migration for 'donationReceipts'
    const oldReceipts = localStorage.getItem('donationReceipts');
    if (oldReceipts && localStorage.getItem(STORAGE_KEYS.RECEIPTS) === '[]') {
        localStorage.setItem(STORAGE_KEYS.RECEIPTS, oldReceipts);
        localStorage.removeItem('donationReceipts');
        console.info('[DB] Migrated receipts from old key.');
    }

    // Migration for 'orgData'
    const oldOrgData = localStorage.getItem('orgData');
    if (oldOrgData && !localStorage.getItem(STORAGE_KEYS.ORG_DATA)) {
        localStorage.setItem(STORAGE_KEYS.ORG_DATA, oldOrgData);
        localStorage.removeItem('orgData');
        console.info('[DB] Migrated orgData from old key.');
    }

    // Migration for 'donationReceiptCounter'
    const oldCounter = localStorage.getItem('donationReceiptCounter');
    if (oldCounter && localStorage.getItem(STORAGE_KEYS.LAST_RECEIPT_NUMBER) === '1000') {
        localStorage.setItem(STORAGE_KEYS.LAST_RECEIPT_NUMBER, oldCounter);
        localStorage.removeItem('donationReceiptCounter');
        console.info('[DB] Migrated counter from old key.');
    }
}

/**
 * Finds a donor by name. If they don't exist, creates them.
 * If they exist, updates their details.
 */
const findOrCreateDonor = (donor: { donorName: string; donorAddress: string; donorEmail: string; donorPhone: string; }): number => {
  const donors: Donor[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DONORS) || '[]');
  
  const existingIndex = donors.findIndex(d => d.name === donor.donorName);
  
  if (existingIndex !== -1) {
    // Update existing donor information if provided
    donors[existingIndex] = {
      ...donors[existingIndex],
      address: donor.donorAddress || donors[existingIndex].address,
      email: donor.donorEmail || donors[existingIndex].email,
      phone: donor.donorPhone || donors[existingIndex].phone,
    };
    localStorage.setItem(STORAGE_KEYS.DONORS, JSON.stringify(donors));
    return existingIndex + 1; // Use 1-based index as a fake ID
  }
  
  // Create new donor
  const newId = donors.length + 1;
  const newDonor: Donor = {
    id: newId,
    name: donor.donorName,
    address: donor.donorAddress,
    email: donor.donorEmail,
    phone: donor.donorPhone
  };
  
  donors.push(newDonor);
  localStorage.setItem(STORAGE_KEYS.DONORS, JSON.stringify(donors));
  return newId;
};

/**
 * Adds a new receipt to the database.
 */
export const addReceipt = async (receiptData: DonationData, shouldSave: boolean = true) => {
  try {
    findOrCreateDonor(receiptData);
    
    const receipts: DonationData[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECEIPTS) || '[]');
    
    // Check if receipt already exists (update) or add new
    const existingIndex = receipts.findIndex(r => r.receiptId === receiptData.receiptId);
    if (existingIndex !== -1) {
        receipts[existingIndex] = receiptData;
    } else {
        receipts.push(receiptData);
    }
    
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
    console.info(`[DB] Receipt ${receiptData.receiptId} saved.`);
  } catch (error) {
    console.error(`[DB] Failed to add receipt:`, error);
    throw error;
  }
};

/**
 * Searches for donors based on a name query for autocomplete.
 */
export const getDonorsForAutocomplete = (query: string): Donor[] => {
  if (!query) return [];
  try {
    const donors: Donor[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DONORS) || '[]');
    const lowerQuery = query.toLowerCase();
    return donors
      .filter(d => d.name.toLowerCase().includes(lowerQuery))
      .slice(0, 10);
  } catch (error) {
    console.error('[DB] Failed to get donors for autocomplete:', error);
    return [];
  }
};

/**
 * Fetches receipts with filtering.
 */
export const getReceipts = (filters: any): DonationData[] => {
  try {
    let receipts: DonationData[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECEIPTS) || '[]');
    
    if (filters.searchTerm) {
      const search = filters.searchTerm.toLowerCase();
      receipts = receipts.filter(r => r.donorName.toLowerCase().includes(search));
    }
    
    if (filters.startDate) {
      receipts = receipts.filter(r => r.donationDate >= filters.startDate);
    }
    
    if (filters.endDate) {
      receipts = receipts.filter(r => r.donationDate <= filters.endDate);
    }
    
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      receipts = receipts.filter(r => {
          const amt = typeof r.donationAmount === 'string' ? parseFloat(r.donationAmount) : r.donationAmount;
          return (r.donationType === 'Cash' && amt >= min) || r.donationType === 'Goods';
      });
    }
    
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      receipts = receipts.filter(r => {
        const amt = typeof r.donationAmount === 'string' ? parseFloat(r.donationAmount) : r.donationAmount;
        return (r.donationType === 'Cash' && amt <= max) || r.donationType === 'Goods';
      });
    }
    
    // Sort by date DESC
    return receipts.sort((a, b) => b.donationDate.localeCompare(a.donationDate));
  } catch (error) {
    console.error('[DB] Failed to get receipts:', error);
    return [];
  }
};

export const getNextReceiptIdString = async (): Promise<string> => {
  const lastNum = localStorage.getItem(STORAGE_KEYS.LAST_RECEIPT_NUMBER) || '1000';
  const nextNum = parseInt(lastNum, 10) + 1;
  return `RCPT-${String(nextNum).padStart(4, '0')}`;
};

export const saveLastReceiptNumber = (receiptId: string) => {
  if (receiptId.startsWith('RCPT-')) {
    const num = receiptId.split('-')[1];
    if (num) {
      localStorage.setItem(STORAGE_KEYS.LAST_RECEIPT_NUMBER, num);
    }
  }
};

export const getOrgData = async (): Promise<OrgData> => {
  const defaultOrgData: OrgData = {
    name: "Generous Hearts Foundation",
    address: "123 Charity Lane, Philanthropy, TX 78701",
    ein: "12-3456789",
  };
  
  const saved = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('[DB] Failed to parse org data.', e);
      return defaultOrgData;
    }
  }
  return defaultOrgData;
};

export const saveOrgData = async (orgData: OrgData) => {
  localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(orgData));
};
