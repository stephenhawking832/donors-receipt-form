import React, { useState, useMemo } from 'react';
import { DonationData } from '../types';
import FormField from './FormField';

interface ReceiptHistoryProps {
  receipts: DonationData[];
  onRedownload: (receipt: DonationData) => void;
  t: (key: string) => string;
}

const ReceiptHistory: React.FC<ReceiptHistoryProps> = ({ receipts, onRedownload, t }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ startDate: '', endDate: '', minAmount: '', maxAmount: '' });
  };

  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      // Search term filter (donor name)
      const nameMatch = receipt.donorName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Date filter
      const donationDate = new Date(receipt.donationDate + 'T00:00:00');
      const startDate = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null;
      const endDate = filters.endDate ? new Date(filters.endDate + 'T00:00:00') : null;
      const dateMatch = (!startDate || donationDate >= startDate) && (!endDate || donationDate <= endDate);

      // Amount filter
      const amount = typeof receipt.donationAmount === 'number' ? receipt.donationAmount : parseFloat(String(receipt.donationAmount));
      const minAmount = filters.minAmount !== '' ? parseFloat(filters.minAmount) : null;
      const maxAmount = filters.maxAmount !== '' ? parseFloat(filters.maxAmount) : null;
      const amountMatch = (minAmount === null || amount >= minAmount) && (maxAmount === null || amount <= maxAmount);

      return nameMatch && dateMatch && amountMatch;
    });
  }, [receipts, searchTerm, filters]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full">
      <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b pb-3">{t('historyTitle')}</h2>
      
      {/* Filters Section */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField 
            label={t('searchDonorLabel')}
            id="searchTerm"
            name="searchTerm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchDonorPlaceholder')}
          />
          <FormField
            label={t('startDateLabel')}
            id="startDate"
            name="startDate"
            type="date"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
          <FormField
            label={t('endDateLabel')}
            id="endDate"
            name="endDate"
            type="date"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
          <div className="flex items-end space-x-2">
            <div className="flex-grow">
              <FormField
                label={t('minAmountLabel')}
                id="minAmount"
                name="minAmount"
                type="number"
                value={filters.minAmount}
                onChange={handleFilterChange}
                placeholder={t('minAmountPlaceholder')}
              />
            </div>
            <div className="flex-grow">
              <FormField
                label={t('maxAmountLabel')}
                id="maxAmount"
                name="maxAmount"
                type="number"
                value={filters.maxAmount}
                onChange={handleFilterChange}
                placeholder={t('maxAmountPlaceholder')}
              />
            </div>
          </div>
        </div>
         <div className="mt-4 flex justify-end">
            <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
            >
                {t('clearFiltersButton')}
            </button>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left rtl:text-right text-slate-500">
          <thead className="text-xs text-slate-700 uppercase bg-slate-100">
            <tr>
              <th scope="col" className="px-6 py-3">{t('receiptIdHeader')}</th>
              <th scope="col" className="px-6 py-3">{t('donorNameHeader')}</th>
              <th scope="col" className="px-6 py-3">{t('dateHeader')}</th>
              <th scope="col" className="px-6 py-3">{t('amountHeader')}</th>
              <th scope="col" className="px-6 py-3 text-center">{t('actionsHeader')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.length > 0 ? (
              filteredReceipts.map((receipt) => (
                <tr key={receipt.receiptId} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{receipt.receiptId}</td>
                  <td className="px-6 py-4">{receipt.donorName}</td>
                  <td className="px-6 py-4">{new Date(receipt.donationDate + 'T00:00:00').toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {receipt.donationType === 'Cash' 
                        ? `$${(typeof receipt.donationAmount === 'number' ? receipt.donationAmount : parseFloat(String(receipt.donationAmount))).toFixed(2)}`
                        : t('goodsOption')
                    }
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onRedownload(receipt)}
                      className="font-medium text-indigo-600 hover:text-indigo-800"
                      aria-label={`Re-download receipt ${receipt.receiptId}`}
                    >
                      {t('redownloadAction')}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-500">
                  {t('noReceiptsFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReceiptHistory;