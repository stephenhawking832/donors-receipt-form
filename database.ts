import initSqlJs from 'sql.js';
import { DonationData, Donor } from './types';

// Let's cache the database instance and the SQL.js config to avoid re-initialization
let dbInstance: any | null = null;
let SQL: any | null = null;

const DB_NAME = 'donations.sqlite';

/**
 * Initializes the SQLite database, creating it from IndexedDB if it exists,
 * or creating a new one otherwise. Also creates the necessary tables.
 */
export const initDB = async () => {
  if (dbInstance) return;

  try {
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });

    const dbFromLocalStorage = await loadDbFromIndexedDB();
    if (dbFromLocalStorage) {
      console.log("Database loaded from IndexedDB.");
      dbInstance = new SQL.Database(dbFromLocalStorage);
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
  dbInstance.exec(createDonorsTable);
  dbInstance.exec(createReceiptsTable);
  console.log("Tables created or already exist.");
};

const saveDbToIndexedDB = async () => {
  if (!dbInstance) return;
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('sqljs-database');
    request.onsuccess = () => {
      const db = request.result;
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
        reject(event);
      };
    };
    request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(DB_NAME);
    };
    request.onerror = (event) => {
        console.error("Error opening IndexedDB", event);
        reject(event);
    };
  });
};

const loadDbFromIndexedDB = async (): Promise<Uint8Array | null> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('sqljs-database');
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DB_NAME)) {
                db.close();
                resolve(null);
                return;
            }
            const transaction = db.transaction(DB_NAME, 'readonly');
            const store = transaction.objectStore(DB_NAME);
            const getRequest = store.get('db');
            getRequest.onsuccess = () => {
                resolve(getRequest.result as Uint8Array | null);
            };
            getRequest.onerror = (event) => reject(event);

            transaction.oncomplete = () => db.close();
        };
        request.onupgradeneeded = () => {
            request.result.createObjectStore(DB_NAME);
            resolve(null); // No data yet
        };
        request.onerror = (event) => reject(event);
    });
}


/**
 * One-time migration from localStorage to SQLite.
 */
const migrateFromLocalStorage = async () => {
    const migrationDone = localStorage.getItem('db_migration_v1_complete');
    if (migrationDone || !dbInstance) {
        return;
    }

    const oldReceiptsJson = localStorage.getItem('donationReceipts');
    if (!oldReceiptsJson) {
        localStorage.setItem('db_migration_v1_complete', 'true');
        return;
    }

    try {
        const oldReceipts: DonationData[] = JSON.parse(oldReceiptsJson);
        if (oldReceipts.length === 0) {
            localStorage.setItem('db_migration_v1_complete', 'true');
            return;
        }

        console.log(`Starting migration of ${oldReceipts.length} receipts from localStorage...`);
        for (const receipt of oldReceipts) {
            await addReceipt(receipt, false); // Add without saving each time
        }

        await saveDbToIndexedDB(); // Save once at the end
        localStorage.setItem('db_migration_v1_complete', 'true');
        // Optional: remove old data after successful migration
        // localStorage.removeItem('donationReceipts');
        console.log("Migration complete!");
    } catch (error) {
        console.error("Error during migration:", error);
    }
};

/**
 * Finds a donor by name. If they don't exist, creates them.
 * If they exist, updates their address/email/phone if the new info is more complete.
 * @returns The donor's ID.
 */
const findOrCreateDonor = (donor: { donorName: string; donorAddress: string; donorEmail: string; donorPhone: string; }): number => {
  const selectStmt = dbInstance.prepare("SELECT * FROM donors WHERE name = :name");
  selectStmt.bind({ ':name': donor.donorName });

  if (selectStmt.step()) {
    const existingDonor = selectStmt.getAsObject();
    selectStmt.free();
    
    // Simple update logic: if new field has value and old one didn't, update.
    const updateNeeded = (
        (donor.donorAddress && !existingDonor.address) ||
        (donor.donorEmail && !existingDonor.email) ||
        (donor.donorPhone && !existingDonor.phone)
    );
    
    if (updateNeeded) {
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
    }
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
