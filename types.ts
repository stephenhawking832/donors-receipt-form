export interface DonationData {
  donorName: string;
  donorAddress: string;
  donorEmail: string;
  donationDate: string;
  donationAmount: number | string;
  donationType: 'Cash' | 'Goods';
  goodsDescription: string;
  receiptId: string;
}

export interface OrgData {
  name: string;
  address: string;
  ein: string;
}

export type Translations = { [key: string]: string };
