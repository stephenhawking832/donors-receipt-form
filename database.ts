import initSqlJs from 'sql.js';
import { DonationData, Donor, OrgData } from './types';

// Let's cache the database instance and the SQL.js config to avoid re-initialization
let dbInstance: any | null = null;
let SQL: any | null = null;

const DB_NAME = 'donations.sqlite';
const INDEXEDDB_NAME = 'sqljs-database';

/**
 * Initializes the SQLite database, creating it from IndexedDB if it exists,
 * or creating a new one otherwise. Also creates the necessary tables.
 */
export const initDB = async () => {
  if (dbInstance) {
    console.info('[DB] Database already initialized.');
    return;
  }

  try {
    console.info('[DB] Initializing SQL.js...');
    SQL = await initSqlJs({
      locateFile: file => `https://aistudiocdn.com/sql.js@1.10.3/dist/${file}`
    });
    console.info('[DB] SQL.js loaded successfully.');

    const dbFromIndexedDB = await loadDbFromIndexedDB();
    if (dbFromIndexedDB) {
      console.info('[DB] Database found in IndexedDB. Loading...');
      dbInstance = new SQL.Database(dbFromIndexedDB);
    } else {
      console.info('[DB] No database found in IndexedDB. Creating a new one.');
      dbInstance = new SQL.Database();
      createTables();
      await saveDbToIndexedDB(); 
      console.info('[DB] New empty database saved to IndexedDB.');
    }

    createTables(); // Ensure tables exist regardless.
    console.info('[DB] Table structure verified.');

    await migrateFromLocalStorage();

  } catch (err) {
    console.error("[DB] CRITICAL: Database initialization failed:", err);
    throw err;
  }
};

const createTables = () => {
  if (!dbInstance) return;
  try {
    const createDonorsTable = `
      CREATE TABLE IF NOT EXISTS donors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT,
        email TEXT,
        phone TEXT
      );
    `;
    const createReceiptsTable = `
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        donor_id INTEGER NOT NULL,
        donation_date TEXT NOT NULL,
        donation_amount REAL,
        donation_type TEXT NOT NULL,
        goods_description TEXT,
        FOREIGN KEY (donor_id) REFERENCES donors (id)
      );
    `;
    const createAppMetaTable = `
      CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT
      );
    `;
    dbInstance.exec(createDonorsTable);
    dbInstance.exec(createReceiptsTable);
    dbInstance.exec(createAppMetaTable);
  } catch (error) {
    console.error('[DB] Failed to create tables:', error);
    throw error;
  }
};

const saveDbToIndexedDB = async () => {
  if (!dbInstance) return;
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      try {
        const transaction = db.transaction(DB_NAME, 'readwrite');
        const store = transaction.objectStore(DB_NAME);
        const data = dbInstance.export();
        store.put(data, 'db');

        transaction.oncomplete = () => {
          console.info('[DB] Database saved successfully to IndexedDB.');
          db.close();
          resolve();
        };

        transaction.onerror = (event) => {
          console.error("[DB] Error during save transaction to IndexedDB:", event);
          db.close();
          reject(event);
        };
      } catch (e) {
         console.error("[DB] Failed to start save transaction. Object store might not exist.", e);
         db.close();
         reject(e);
      }
    };
    
    request.onerror = (event) => {
        console.error("[DB] Error opening IndexedDB for saving:", event);
        reject(event);
    };
  });
};

const loadDbFromIndexedDB = async (): Promise<Uint8Array | null> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(INDEXEDDB_NAME);
        
        request.onupgradeneeded = () => {
            console.info('[DB] IndexedDB upgrade needed. Creating object store.');
            const db = request.result;
            if (!db.objectStoreNames.contains(DB_NAME)) {
                db.createObjectStore(DB_NAME);
            }
        };

        request.onsuccess = () => {
            const db = request.result;
            
            if (!db.objectStoreNames.contains(DB_NAME)) {
                 console.warn("[DB] IndexedDB object store not found after open. This can happen on first run.");
                 db.close();
                 resolve(null);
                 return;
            }

            const transaction = db.transaction(DB_NAME, 'readonly');
            const store = transaction.objectStore(DB_NAME);
            const getRequest = store.get('db');
            
            transaction.oncomplete = () => {
                db.close();
            };

            getRequest.onsuccess = () => {
                resolve((getRequest.result as Uint8Array) || null);
            };

            getRequest.onerror = (event) => {
                console.error("[DB] Failed to read from IndexedDB store:", event);
                db.close();
                reject(event);
            };
        };

        request.onerror = (event) => {
            console.error("[DB] Failed to open IndexedDB:", event);
            reject(event);
        };
    });
}


/**
 * One-time migration from localStorage to SQLite.
 */
const migrateFromLocalStorage = async () => {
    const migrationDone = localStorage.getItem('db_migration_v2_complete');
    if (migrationDone || !dbInstance) {
        return;
    }
    console.info('[DB] Starting one-time migration from localStorage...');

    let migrationOccurred = false;

    // 1. Migrate old receipts
    const oldReceiptsJson = localStorage.getItem('donationReceipts');
    if (oldReceiptsJson) {
        try {
            const oldReceipts: DonationData[] = JSON.parse(oldReceiptsJson);
            if (oldReceipts.length > 0) {
                console.info(`[DB] Migrating ${oldReceipts.length} receipts from localStorage.`);
                migrationOccurred = true;
                for (const receipt of oldReceipts) {
                    await addReceipt(receipt, false); // Add without saving each time
                }
            }
        } catch (error) {
            console.error("[DB] Error migrating receipts from localStorage:", error);
        }
    }

    // 2. Migrate orgData
    const oldOrgData = localStorage.getItem('orgData');
    if (oldOrgData) {
        try {
            const parsedOrgData = JSON.parse(oldOrgData);
            if (parsedOrgData.name) {
                console.info('[DB] Migrating org data from localStorage.');
                migrationOccurred = true;
                await saveOrgData(parsedOrgData, false);
            }
        } catch(e) { console.error("[DB] Error migrating org data from localStorage", e); }
    }
    
    // 3. Migrate receipt counter
    const lastReceiptNumber = localStorage.getItem('donationReceiptCounter');
    if (lastReceiptNumber) {
        console.info('[DB] Migrating receipt counter from localStorage.');
        migrationOccurred = true;
        setMeta('last_receipt_number', lastReceiptNumber);
    }

    if (migrationOccurred) {
        await saveDbToIndexedDB();
        console.info('[DB] Migration complete. Database saved.');
    } else {
        console.info('[DB] No data found in localStorage to migrate.');
    }

    localStorage.setItem('db_migration_v2_complete', 'true');
};

/**
 * Finds a donor by name. If they don't exist, creates them.
 * If they exist, updates their details with the new information provided.
 * @returns The donor's ID.
 */
const findOrCreateDonor = (donor: { donorName: string; donorAddress: string; donorEmail: string; donorPhone: string; }): number => {
  try {
    const selectStmt = dbInstance.prepare("SELECT * FROM donors WHERE name = :name");
    selectStmt.bind({ ':name': donor.donorName });

    if (selectStmt.step()) {
        const existingDonor = selectStmt.getAsObject();
        selectStmt.free();
        
        const updateStmt = dbInstance.prepare(`
            UPDATE donors 
            SET address = :address, email = :email, phone = :phone 
            WHERE id = :id
        `);
        updateStmt.run({
            ':address': donor.donorAddress || existingDonor.address,
            ':email': donor.donorEmail || existingDonor.email,
            ':phone': donor.donorPhone || existingDonor.phone,
            ':id': existingDonor.id
        });
        updateStmt.free();
        
        return existingDonor.id;
    }
    selectStmt.free();

    const insertStmt = dbInstance.prepare("INSERT INTO donors (name, address, email, phone) VALUES (:name, :address, :email, :phone)");
    insertStmt.run({
        ':name': donor.donorName,
        ':address': donor.donorAddress,
        ':email': donor.donorEmail,
        ':phone': donor.donorPhone
    });
    insertStmt.free();

    return dbInstance.exec("SELECT last_insert_rowid()")[0].values[0][0];
  } catch (error) {
    console.error('[DB] Error in findOrCreateDonor:', error);
    throw error;
  }
};

/**
 * Adds a new receipt to the database.
 */
export const addReceipt = async (receiptData: DonationData, shouldSave: boolean = true) => {
  if (!dbInstance) throw new Error("Database not initialized.");
  
  try {
    const donorId = findOrCreateDonor(receiptData);

    const insertStmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO receipts (receipt_number, donor_id, donation_date, donation_amount, donation_type, goods_description)
        VALUES (:receipt_number, :donor_id, :donation_date, :donation_amount, :donation_type, :goods_description)
    `);
    
    insertStmt.run({
        ':receipt_number': receiptData.receiptId,
        ':donor_id': donorId,
        ':donation_date': receiptData.donationDate,
        ':donation_amount': receiptData.donationType === 'Cash' ? parseFloat(String(receiptData.donationAmount)) || 0 : null,
        ':donation_type': receiptData.donationType,
        ':goods_description': receiptData.donationType === 'Goods' ? receiptData.goodsDescription : null
    });

    insertStmt.free();
    console.info(`[DB] Receipt ${receiptData.receiptId} added to transaction.`);

    if (shouldSave) {
        await saveDbToIndexedDB();
    }
  } catch (error) {
    console.error(`[DB] Failed to add receipt ${receiptData.receiptId}:`, error);
    throw error;
  }
};


/**
 * Searches for donors based on a name query for autocomplete.
 */
export const getDonorsForAutocomplete = (query: string): Donor[] => {
  if (!dbInstance || !query) return [];
  try {
    const stmt = dbInstance.prepare("SELECT * FROM donors WHERE name LIKE :query ORDER BY name LIMIT 10");
    stmt.bind({ ':query': `%${query}%` });

    const donors: Donor[] = [];
    while (stmt.step()) {
        donors.push(stmt.getAsObject() as Donor);
    }
    stmt.free();
    return donors;
  } catch (error) {
    console.error('[DB] Failed to get donors for autocomplete:', error);
    return [];
  }
};


/**
 * Fetches receipts with filtering and joins with donor information.
 */
export const getReceipts = (filters: any): DonationData[] => {
    if (!dbInstance) return [];
    
    try {
        let query = `
        SELECT
            r.receipt_number as receiptId,
            d.name as donorName,
            d.address as donorAddress,
            d.email as donorEmail,
            d.phone as donorPhone,
            r.donation_date as donationDate,
            r.donation_amount as donationAmount,
            r.donation_type as donationType,
            r.goods_description as goodsDescription
        FROM receipts r
        JOIN donors d ON r.donor_id = d.id
        `;
        
        const whereClauses = [];
        const params: { [key: string]: any } = {};

        if (filters.searchTerm) {
            whereClauses.push("d.name LIKE :searchTerm");
            params[':searchTerm'] = `%${filters.searchTerm}%`;
        }
        if (filters.startDate) {
            whereClauses.push("r.donation_date >= :startDate");
            params[':startDate'] = filters.startDate;
        }
        if (filters.endDate) {
            whereClauses.push("r.donation_date <= :endDate");
            params[':endDate'] = filters.endDate;
        }
        if (filters.minAmount) {
            whereClauses.push("r.donation_amount >= :minAmount");
            params[':minAmount'] = parseFloat(filters.minAmount);
        }
        if (filters.maxAmount) {
            whereClauses.push("r.donation_amount <= :maxAmount");
            params[':maxAmount'] = parseFloat(filters.maxAmount);
        }

        if (whereClauses.length > 0) {
            query += " WHERE " + whereClauses.join(" AND ");
        }
        
        query += " ORDER BY r.donation_date DESC, r.id DESC";
        
        const stmt = dbInstance.prepare(query);
        stmt.bind(params);
        
        const receipts: DonationData[] = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            receipts.push({
                ...row,
                donationAmount: row.donationType === 'Cash' ? (row.donationAmount || 0) : '',
                goodsDescription: row.donationType === 'Goods' ? (row.goodsDescription || '') : ''
            } as DonationData);
        }
        stmt.free();
        return receipts;
    } catch(error) {
        console.error('[DB] Failed to get receipts:', error);
        return [];
    }
};

// --- Meta Data Management ---
const getMeta = (key: string): string | null => {
    if (!dbInstance) return null;
    try {
        const stmt = dbInstance.prepare("SELECT value FROM app_meta WHERE key = ?");
        stmt.bind([key]);
        const result = stmt.step() ? stmt.get()[0] : null;
        stmt.free();
        return result;
    } catch (error) {
        console.error(`[DB] Failed to get meta key "${key}":`, error);
        return null;
    }
}

const setMeta = (key: string, value: string) => {
    if (!dbInstance) return;
    try {
        const stmt = dbInstance.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)");
        stmt.run([key, value]);
        stmt.free();
    } catch (error) {
        console.error(`[DB] Failed to set meta key "${key}":`, error);
    }
}

export const getNextReceiptIdString = async (): Promise<string> => {
    if (!dbInstance) return 'RCPT-1001';
    
    const lastReceiptNumberStr = getMeta('last_receipt_number');
    const lastReceiptNumber = parseInt(lastReceiptNumberStr || '1000', 10);
    const nextReceiptNumber = lastReceiptNumber + 1;
    
    return `RCPT-${String(nextReceiptNumber).padStart(4, '0')}`;
};

export const saveLastReceiptNumber = (receiptId: string) => {
    if (!dbInstance) return;
    try {
        if (receiptId.startsWith('RCPT-')) {
            const usedReceiptNumber = parseInt(receiptId.split('-')[1], 10);
            if (!isNaN(usedReceiptNumber)) {
                setMeta('last_receipt_number', String(usedReceiptNumber));
            }
        }
    } catch (error) {
        console.error('[DB] Failed to save last receipt number:', error);
    }
}

export const getOrgData = async (): Promise<OrgData> => {
    const defaultOrgData = {
        name: "Generous Hearts Foundation",
        address: "123 Charity Lane, Philanthropy, TX 78701",
        ein: "12-3456789",
    };
    if (!dbInstance) return defaultOrgData;

    const orgDataJson = getMeta('org_data');
    if (orgDataJson) {
        try {
            return JSON.parse(orgDataJson);
        } catch (e) {
            console.error('[DB] Failed to parse org_data from database. Returning default.', e);
            return defaultOrgData;
        }
    }
    return defaultOrgData;
}

export const saveOrgData = async (orgData: OrgData, shouldSave: boolean = true) => {
    if (!dbInstance) return;
    try {
        setMeta('org_data', JSON.stringify(orgData));
        if (shouldSave) {
            await saveDbToIndexedDB();
        }
    } catch (error) {
        console.error('[DB] Failed to save org data:', error);
        throw error; // Re-throw to notify the caller
    }
}