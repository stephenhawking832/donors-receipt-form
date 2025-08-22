import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DonationData, OrgData, Translations } from './types';
import FormField from './components/FormField';
import ReceiptPreview from './components/ReceiptPreview';
import ReceiptHistory from './components/ReceiptHistory';
import Settings from './components/Settings';

const isPwaMode = window.matchMedia('(display-mode: standalone)').matches;

// Helper function to get the next available receipt ID.
const getNextReceiptId = (): string => {
  const lastReceiptNumber = parseInt(localStorage.getItem('donationReceiptCounter') || '1000', 10);
  const nextReceiptNumber = lastReceiptNumber + 1;
  return `RCPT-${String(nextReceiptNumber).padStart(4, '0')}`;
};

const defaultOrgData: OrgData = {
  name: "Generous Hearts Foundation",
  address: "123 Charity Lane, Philanthropy, TX 78701",
  ein: "12-3456789",
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
  
  const [orgData, setOrgData] = useState<OrgData>(defaultOrgData);
  const [isLoading, setIsLoading] = useState(false);
  const [savedReceipts, setSavedReceipts] = useState<DonationData[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'settings'>('create');
  const [language, setLanguage] = useState<'en' | 'he'>(localStorage.getItem('appLanguage') as 'en' | 'he' || 'en');
  const [currentTranslations, setCurrentTranslations] = useState<Translations>({});

  useEffect(() => {
    // Load config and saved receipts from localStorage on initial render ONLY if in PWA mode
    const loadData = () => {
        if (!isPwaMode) return;

        try {
            const storedOrgData = localStorage.getItem('orgData');
            if (storedOrgData) {
                setOrgData(JSON.parse(storedOrgData));
            } else {
                setOrgData(defaultOrgData); // Fallback to default if nothing in storage
            }
        } catch (error) {
            console.error("Failed to parse org data from localStorage", error);
            setOrgData(defaultOrgData);
        }
    
        try {
          const storedReceipts = localStorage.getItem('donationReceipts');
          if (storedReceipts) {
            setSavedReceipts(JSON.parse(storedReceipts));
          }
        } catch (error) {
          console.error("Failed to parse receipts from localStorage", error);
        }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    localStorage.setItem('appLanguage', language);

    const loadTranslations = async () => {
      let translationsUrl = `./locales/${language}.json`;
      try {
        let response = await fetch(translationsUrl);
        if (!response.ok) {
          console.error(`Failed to load ${translationsUrl}, falling back to English.`);
          translationsUrl = `./locales/en.json`;
          response = await fetch(translationsUrl);
        }
        if (!response.ok) {
          throw new Error('Failed to load primary and fallback translations.');
        }
        const data = await response.json();
        setCurrentTranslations(data);
      } catch (error) {
        console.error(error);
        setCurrentTranslations({}); // Set to empty on error to avoid breaking the app
      }
    };

    loadTranslations();
  }, [language]);
  
  const t = useCallback((key: string): string => {
    return currentTranslations[key] || key;
  }, [currentTranslations]);


  const handleOrgDataChange = (newOrgData: OrgData) => {
    setOrgData(newOrgData);
    if (isPwaMode) {
      localStorage.setItem('orgData', JSON.stringify(newOrgData));
    }
  };

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

  const generatePdf = async (data: DonationData) => {
    // Temporarily set form data to the data we want to print
    const originalFormData = { ...formData }; // Store current form state
    setFormData(data);
    setIsLoading(true);

    // Allow React to re-render with the new data before capturing
    await new Promise(resolve => setTimeout(resolve, 0));

    const receiptElement = document.getElementById('receipt-preview');
    if (!receiptElement) {
      console.error('Receipt element not found!');
      setIsLoading(false);
      return false;
    }

    try {
      const canvas = await html2canvas(receiptElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`donation-receipt-${data.receiptId}.pdf`);
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Sorry, there was an error generating the PDF. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
      setFormData(originalFormData); // Restore the original form state
    }
  };

  const handleGenerateAndSavePdf = async () => {
    const success = await generatePdf(formData);

    // Only save the receipt and update ID if in PWA mode
    if (success && isPwaMode) {
      // Add new receipt to the beginning of the history
      const newSavedReceipts = [formData, ...savedReceipts];
      setSavedReceipts(newSavedReceipts);
      localStorage.setItem('donationReceipts', JSON.stringify(newSavedReceipts));

      // Update the counter in localStorage
      const usedReceiptId = formData.receiptId;
      if (usedReceiptId.startsWith('RCPT-')) {
        const usedReceiptNumber = parseInt(usedReceiptId.split('-')[1], 10);
        if (!isNaN(usedReceiptNumber)) {
          localStorage.setItem('donationReceiptCounter', String(usedReceiptNumber));
        }
      }

      // Reset form for the next entry and get the next ID
      const newReceiptId = getNextReceiptId();
      setFormData(prev => ({
          ...prev, 
          // Reset fields you want to clear, but maybe keep some like date
          donorName: '',
          donorAddress: '',
          donorEmail: '',
          donationAmount: '',
          goodsDescription: '',
          receiptId: newReceiptId 
      }));
    }
  };
  
  const handleRedownload = async (receipt: DonationData) => {
    await generatePdf(receipt);
    // After re-download, the form state is already restored by the finally block in generatePdf
  };

  const TabButton: React.FC<{tabId: 'create' | 'history' | 'settings', children: React.ReactNode}> = ({ tabId, children }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === tabId
          ? 'bg-indigo-600 text-white shadow'
          : 'text-slate-600 hover:bg-slate-200'
      }`}
      aria-pressed={activeTab === tabId}
    >
      {children}
    </button>
  );

  const donationTypeOptions = [
    { value: 'Cash', label: t('cashOption') },
    { value: 'Goods', label: t('goodsOption') }
  ];

  return (
    <main className="bg-slate-50 min-h-screen font-sans p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto">
        <header className="text-center mb-8 relative">
          <div className="absolute top-0 left-0">
            <div className="flex space-x-1 bg-slate-200 p-1 rounded-md">
              <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-xs rounded ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}>EN</button>
              <button onClick={() => setLanguage('he')} className={`px-3 py-1 text-xs rounded ${language === 'he' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}>HE</button>
            </div>
          </div>
          <div className="inline-block bg-indigo-100 text-indigo-600 p-3 rounded-full mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{t('mainTitle')}</h1>
          <p className="text-slate-500 mt-2">{t('mainSubtitle')}</p>
        </header>

        <div className="flex justify-center mb-6">
          <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
            <TabButton tabId="create">{t('createReceiptTab')}</TabButton>
            <TabButton tabId="history">{t('historyTab')}</TabButton>
            <TabButton tabId="settings">{t('settingsTab')}</TabButton>
          </div>
        </div>
        
        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-slate-700 mb-6 border-b pb-3">{t('receiptDetailsTitle')}</h2>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <FormField label={t('donorNameLabel')} id="donorName" name="donorName" type="text" value={formData.donorName} onChange={handleChange} required />
                <FormField label={t('donorAddressLabel')} id="donorAddress" name="donorAddress" as="textarea" value={formData.donorAddress} onChange={handleChange} required />
                <FormField label={t('donorEmailLabel')} id="donorEmail" name="donorEmail" type="email" value={formData.donorEmail} onChange={handleChange} required />
                <FormField label={t('donationDateLabel')} id="donationDate" name="donationDate" type="date" value={formData.donationDate} onChange={handleChange} required />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t('donationTypeLabel')} id="donationType" name="donationType" as="select" options={donationTypeOptions} value={formData.donationType} onChange={handleChange} />
                  {formData.donationType === 'Cash' && (
                    <FormField label={t('amountLabel')} id="donationAmount" name="donationAmount" type="number" value={formData.donationAmount} onChange={handleChange} required />
                  )}
                </div>
                {formData.donationType === 'Goods' && (
                  <FormField label={t('goodsDescriptionLabel')} id="goodsDescription" name="goodsDescription" as="textarea" value={formData.goodsDescription} onChange={handleChange} placeholder={t('goodsDescriptionPlaceholder')} required />
                )}
                <button
                  type="button"
                  onClick={handleGenerateAndSavePdf}
                  disabled={isLoading}
                  className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('generatingButton')}
                    </>
                  ) : (
                    t(isPwaMode ? 'generateButton' : 'downloadButton')
                  )}
                </button>
              </form>
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-slate-700 mb-4 text-center lg:text-left">{t('livePreviewTitle')}</h2>
              <div className="bg-white p-2 rounded-lg shadow-md flex-grow">
                  <ReceiptPreview data={formData} orgData={orgData} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <ReceiptHistory receipts={savedReceipts} onRedownload={handleRedownload} t={t} />
        )}

        {activeTab === 'settings' && (
          <Settings orgData={orgData} onOrgDataChange={handleOrgDataChange} t={t} />
        )}

      </div>
    </main>
  );
};

export default App;