import React from 'react';
import { DonationData } from '../types';

interface ReceiptPreviewProps {
  data: DonationData;
}

const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ data }) => {
  const { donorName, donorAddress, donorEmail, donationDate, donationAmount, donationType, goodsDescription, receiptId } = data;
  
  const orgDetails = {
    name: "Generous Hearts Foundation",
    address: "123 Charity Lane, Philanthropy, TX 78701",
    ein: "12-3456789",
  };
  
  const formattedAmount = typeof donationAmount === 'number' 
    ? `$${donationAmount.toFixed(2)}` 
    : (donationAmount ? `$${parseFloat(String(donationAmount)).toFixed(2)}` : '$0.00');

  return (
    <div id="receipt-preview" className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm font-sans text-gray-800 w-full max-w-md mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start pb-4 border-b">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-gray-900">{orgDetails.name}</h1>
          <p className="text-xs text-gray-500">{orgDetails.address}</p>
          <p className="text-xs text-gray-500">EIN: {orgDetails.ein}</p>
        </div>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-4">
        <h2 className="text-xl font-semibold uppercase tracking-widest text-gray-700">Donation Receipt</h2>
        <p className="text-xs text-gray-500 mt-1">Receipt ID: {receiptId || 'N/A'}</p>
      </div>
      
      {/* Donor Information */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-600 border-b pb-1 mb-2">Donor Information</h3>
        <p className="text-sm"><strong>Name:</strong> {donorName || 'Not Provided'}</p>
        <p className="text-sm"><strong>Address:</strong> {donorAddress || 'Not Provided'}</p>
        <p className="text-sm"><strong>Email:</strong> {donorEmail || 'Not Provided'}</p>
      </div>

      {/* Donation Details */}
      <div className="flex-grow">
        <h3 className="text-sm font-semibold text-gray-600 border-b pb-1 mb-2">Donation Details</h3>
        <div className="flex justify-between items-center text-sm mb-1">
          <span>Date of Donation:</span>
          <span>{donationDate ? new Date(donationDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</span>
        </div>
        <div className="flex justify-between items-center text-sm mb-1">
          <span>Donation Type:</span>
          <span>{donationType}</span>
        </div>
        {donationType === 'Cash' && (
          <div className="flex justify-between items-center text-lg font-bold bg-indigo-50 p-3 rounded-md mt-2">
            <span>Amount:</span>
            <span>{formattedAmount}</span>
          </div>
        )}
        {donationType === 'Goods' && (
          <div className="mt-2 text-sm bg-gray-50 p-3 rounded-md">
            <p className="font-semibold">Description of Goods:</p>
            <p className="italic text-gray-600">{goodsDescription || 'No description provided.'}</p>
          </div>
        )}
      </div>

      {/* Footer & Disclaimer */}
      <div className="mt-6 pt-4 border-t text-center">
        <p className="text-sm font-semibold">Thank you for your generous contribution!</p>
        <p className="text-xs text-gray-500 mt-2">
          No goods or services were provided in exchange for this contribution. This receipt is for your tax purposes. 
          Please consult with your tax advisor for the specific tax-deductible amount.
        </p>
      </div>
    </div>
  );
};

export default ReceiptPreview;