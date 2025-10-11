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
  if (dbInstance) return;

  try {
    SQL = await initSqlJs({
      locateFile: file => `./${file}`
    });

    const dbFromIndexedDB = await loadDbFromIndexedDB();
    if (dbFromIndexedDB) {
      console.log("Database loaded from IndexedDB.");
      dbInstance = new SQL.Database(dbFromIndexedDB);
    } else {
      console.log("Creating a new database.");
      dbInstance = new SQL.Database();
      createTables();
      await saveDbToIndexedDB(); // Save the initial empty DB
    }

    await migrateFromLocalStorage();

  } catch (err) {
    console.error("Database initialization failed:", err);
  }
};

const createTables = () => {
  if (!dbInstance) return;
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
  console.log("Tables created or already exist.");
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
          db.close();
          resolve();
        };

        transaction.onerror = (event) => {
          console.error("Error saving DB to IndexedDB", event);
          db.close();
          reject(event);
        };
      } catch (e) {
         console.error("Failed to start save transaction. Did the object store get created?", e);
         db.close();
         reject(e);
      }
    };
    
    request.onerror = (event) => {
        console.error("Error opening IndexedDB for saving", event);
        reject(event);
    };
  });
};

const loadDbFromIndexedDB = async (): Promise<Uint8Array | null> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(INDEXEDDB_NAME);
        
        // This is the single source of truth for schema creation.
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DB_NAME)) {
                db.createObjectStore(DB_NAME);
                console.log("Created IndexedDB object store:", DB_NAME);
            }
        };

        request.onsuccess = () => {
            const db = request.result;
            
            // onupgradeneeded's transaction is complete by the time onsuccess fires.
            if (!db.objectStoreNames.contains(DB_NAME)) {
                 // This should not happen if onupgradeneeded worked correctly.
                 console.error("IndexedDB object store not found after open.");
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
                // getRequest.result is undefined if the 'db' key doesn't exist yet.
                resolve((getRequest.result as Uint8Array) || null);
            };

            getRequest.onerror = (event) => {
                console.error("Failed to read from IndexedDB", event);
                db.close();
                reject(event);
            };
        };

        request.onerror = (event) => {
            console.error("Failed to open IndexedDB", event);
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

    console.log("Starting data migration from localStorage...");
    let migrationOccurred = false;

    // 1. Migrate old receipts
    const oldReceiptsJson = localStorage.getItem('donationReceipts');
    if (oldReceiptsJson) {
        try {
            const oldReceipts: DonationData[] = JSON.parse(oldReceiptsJson);
            if (oldReceipts.length > 0) {
                migrationOccurred = true;
                console.log(`Migrating ${oldReceipts.length} receipts...`);
                for (const receipt of oldReceipts) {
                    await addReceipt(receipt, false); // Add without saving each time
                }
                // localStorage.removeItem('donationReceipts');
            }
        } catch (error) {
            console.error("Error migrating receipts:", error);
        }
    }

    // 2. Migrate orgData
    const oldOrgData = localStorage.getItem('orgData');
    if (oldOrgData) {
        try {
            const parsedOrgData = JSON.parse(oldOrgData);
            if (parsedOrgData.name) {
                migrationOccurred = true;
                console.log("Migrating organization data...");
                await saveOrgData(parsedOrgData, false);
                // localStorage.removeItem('orgData');
            }
        } catch(e) { console.error("Error migrating org data", e); }
    }
    
    // 3. Migrate receipt counter
    const lastReceiptNumber = localStorage.getItem('donationReceiptCounter');
    if (lastReceiptNumber) {
        migrationOccurred = true;
        console.log("Migrating receipt counter...");
        setMeta('last_receipt_number', lastReceiptNumber);
        // localStorage.removeItem('donationReceiptCounter');
    }

    if (migrationOccurred) {
        await saveDbToIndexedDB(); // Save once at the end of all migrations
        console.log("Migration complete!");
    }

    localStorage.setItem('db_migration_v2_complete', 'true');
};

/**
 * Finds a donor by name. If they don't exist, creates them.
 * If they exist, updates their details with the new information provided.
 * @returns The donor's ID.
 */
const findOrCreateDonor = (donor: { donorName: string; donorAddress: string; donorEmail: string; donorPhone: string; }): number => {
  const selectStmt = dbInstance.prepare("SELECT * FROM donors WHERE name = :name");
  selectStmt.bind({ ':name': donor.donorName });

  if (selectStmt.step()) {
    const existingDonor = selectStmt.getAsObject();
    selectStmt.free();
    
    // Always update with the latest info from the form, assuming it's the most current.
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
};

/**
 * Adds a new receipt to the database.
 */
export const addReceipt = async (receiptData: DonationData, shouldSave: boolean = true) => {
  if (!dbInstance) throw new Error("Database not initialized.");

  const donorId = findOrCreateDonor(receiptData);

  const insertStmt = dbInstance.prepare(`
    INSERT INTO receipts (receipt_number, donor_id, donation_date, donation_amount, donation_type, goods_description)
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
  if (shouldSave) {
    await saveDbToIndexedDB();
  }
};


/**
 * Searches for donors based on a name query for autocomplete.
 */
export const getDonorsForAutocomplete = (query: string): Donor[] => {
  if (!dbInstance || !query) return [];

  const stmt = dbInstance.prepare("SELECT * FROM donors WHERE name LIKE :query ORDER BY name LIMIT 10");
  stmt.bind({ ':query': `%${query}%` });

  const donors: Donor[] = [];
  while (stmt.step()) {
    donors.push(stmt.getAsObject() as Donor);
  }
  stmt.free();
  return donors;
};


/**
 * Fetches receipts with filtering and joins with donor information.
 */
export const getReceipts = (filters: any): DonationData[] => {
    if (!dbInstance) return [];

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
        // Ensure amount is a number for 'Cash' donations, and description is a string for 'Goods'
        receipts.push({
            ...row,
            donationAmount: row.donationType === 'Cash' ? (row.donationAmount || 0) : '',
            goodsDescription: row.donationType === 'Goods' ? (row.goodsDescription || '') : ''
        } as DonationData);
    }
    stmt.free();
    return receipts;
};

// --- Meta Data Management ---
const getMeta = (key: string): string | null => {
    if (!dbInstance) return null;
    const stmt = dbInstance.prepare("SELECT value FROM app_meta WHERE key = ?");
    stmt.bind([key]);
    const result = stmt.step() ? stmt.get()[0] : null;
    stmt.free();
    return result;
}

const setMeta = (key: string, value: string) => {
    if (!dbInstance) return;
    const stmt = dbInstance.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)");
    stmt.run([key, value]);
    stmt.free();
}

export const getNextReceiptIdString = async (): Promise<string> => {
    if (!dbInstance) return 'RCPT-1001';
    
    const lastReceiptNumberStr = getMeta('last_receipt_number');
    const lastReceiptNumber = parseInt(lastReceiptNumberStr || '1000', 10);
    const nextReceiptNumber = lastReceiptNumber + 1;
    
    // This function now only calculates. Saving the number happens when the receipt is saved.
    return `RCPT-${String(nextReceiptNumber).padStart(4, '0')}`;
};

export const saveLastReceiptNumber = (receiptId: string) => {
    if (!dbInstance) return;
    if (receiptId.startsWith('RCPT-')) {
        const usedReceiptNumber = parseInt(receiptId.split('-')[1], 10);
        if (!isNaN(usedReceiptNumber)) {
            setMeta('last_receipt_number', String(usedReceiptNumber));
        }
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
            return defaultOrgData;
        }
    }
    return defaultOrgData;
}

export const saveOrgData = async (orgData: OrgData, shouldSave: boolean = true) => {
    if (!dbInstance) return;
    setMeta('org_data', JSON.stringify(orgData));
    if (shouldSave) {
        await saveDbToIndexedDB();
    }
}