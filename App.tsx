import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DonationData } from './types';
import FormField from './components/FormField';
import ReceiptPreview from './components/ReceiptPreview';

// Helper function to get the next available receipt ID.
// It reads the last used number from localStorage, increments it, and returns the new formatted ID.
const getNextReceiptId = (): string => {
  // Get the last saved counter, default to 1000 if not found.
  const lastReceiptNumber = parseInt(localStorage.getItem('donationReceiptCounter') || '1000', 10);
  const nextReceiptNumber = lastReceiptNumber + 1;
  // Format the ID with padding for a consistent look (e.g., RCPT-1001)
  return `RCPT-${String(nextReceiptNumber).padStart(4, '0')}`;
};


const App: React.FC = () => {
  const [formData, setFormData] = useState<DonationData>({
    donorName: 'Jane Doe',
    donorAddress: '456 Giving St, Anytown, USA 12345',
    donorEmail: 'jane.doe@example.com',
    donationDate: new Date().toISOString().split('T')[0],
    donationAmount: 100,
    donationType: 'Cash',
    goodsDescription: '',
    receiptId: getNextReceiptId(),
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue: string | number = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const handleGeneratePdf = async () => {
    const receiptElement = document.getElementById('receipt-preview');
    if (!receiptElement) {
      console.error('Receipt element not found!');
      return;
    }
    
    setIsLoading(true);

    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true, 
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`donation-receipt-${formData.receiptId}.pdf`);

      // On successful PDF save, update the counter in localStorage
      const usedReceiptId = formData.receiptId;
      // Extract the number from the ID (e.g., "RCPT-1001" -> 1001)
      if (usedReceiptId.startsWith('RCPT-')) {
        const usedReceiptNumber = parseInt(usedReceiptId.split('-')[1], 10);
        if (!isNaN(usedReceiptNumber)) {
          // Save the number of the receipt that was just generated.
          localStorage.setItem('donationReceiptCounter', String(usedReceiptNumber));
        }
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Sorry, there was an error generating the PDF. Please try again.');
    } finally {
      setIsLoading(false);
      // Update the form to show the next receipt ID for the next transaction.
      // If the PDF failed, getNextReceiptId will return the same ID.
      // If it succeeded, it will return the next incremented ID.
      setFormData(prev => ({ ...prev, receiptId: getNextReceiptId() }));
    }
  };

  return (
    <main className="bg-slate-50 min-h-screen font-sans p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
            <div className="inline-block bg-indigo-100 text-indigo-600 p-3 rounded-full mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </div>
          <h1 className="text-3xl font-bold text-slate-800">Donation Receipt Generator</h1>
          <p className="text-slate-500 mt-2">Fill in the details below to generate a PDF receipt.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-slate-700 mb-6 border-b pb-3">Receipt Details</h2>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <FormField label="Donor Full Name" id="donorName" name="donorName" type="text" value={formData.donorName} onChange={handleChange} required />
              <FormField label="Donor Full Address" id="donorAddress" name="donorAddress" as="textarea" value={formData.donorAddress} onChange={handleChange} required />
              <FormField label="Donor Email" id="donorEmail" name="donorEmail" type="email" value={formData.donorEmail} onChange={handleChange} required />
              <FormField label="Donation Date" id="donationDate" name="donationDate" type="date" value={formData.donationDate} onChange={handleChange} required />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Donation Type" id="donationType" name="donationType" as="select" options={['Cash', 'Goods']} value={formData.donationType} onChange={handleChange} />
                {formData.donationType === 'Cash' && (
                  <FormField label="Amount (USD)" id="donationAmount" name="donationAmount" type="number" value={formData.donationAmount} onChange={handleChange} required />
                )}
              </div>
              
              {formData.donationType === 'Goods' && (
                <FormField label="Description of Goods" id="goodsDescription" name="goodsDescription" as="textarea" value={formData.goodsDescription} onChange={handleChange} placeholder="e.g., 1 computer, 5 blankets" required />
              )}
              
              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={isLoading}
                className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating PDF...
                  </>
                ) : (
                  'Download Receipt as PDF'
                )}
              </button>
            </form>
          </div>

          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-slate-700 mb-4 text-center lg:text-left">Live Preview</h2>
            <div className="bg-white p-2 rounded-lg shadow-md flex-grow">
                <ReceiptPreview data={formData} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default App;