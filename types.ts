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