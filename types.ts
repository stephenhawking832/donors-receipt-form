export interface DonationData {
  donorName: string;
  donorAddress: string;
  donorEmail: string;
  donorPhone: string;
  donationDate: string;
  donationAmount: number | string;
  donationType: 'Cash' | 'Goods';
  goodsDescription: string;
  receiptId: string; // The RCPT-XXXX string
}

export interface Donor {
  id?: number; // Optional because it's set by the DB
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface Receipt {
    id?: number;
    receipt_number: string;
    donor_id: number;
    donation_date: string;
    donation_amount: number | null;
    donation_type: 'Cash' | 'Goods';
    goods_description: string | null;
}

export interface OrgData {
  name: string;
  address: string;
  ein: string;
}

export type Translations = { [key: string]: string };

export type HistoryFilter = {
  searchTerm: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
};
