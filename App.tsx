import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DonationData, OrgData, Translations, Donor, HistoryFilter } from './types';
import FormField from './components/FormField';
import ReceiptPreview from './components/ReceiptPreview';
import ReceiptHistory from './components/ReceiptHistory';
import Settings from './components/Settings';
import * as db from './database';

const isPwaMode = window.matchMedia('(display-mode: standalone)').matches;

const enTranslations: Translations = {
  "mainTitle": "Donation Receipt Generator",
  "mainSubtitle": "Create and manage your donation receipts with ease.",
  "createReceiptTab": "Create Receipt",
  "historyTab": "Receipt History",
  "settingsTab": "Settings",
  "receiptDetailsTitle": "Receipt Details",
  "donorNameLabel": "Donor Full Name",
  "donorAddressLabel": "Donor Full Address",
  "donorEmailLabel": "Donor Email",
  "donorPhoneLabel": "Donor Phone",
  "donationDateLabel": "Donation Date",
  "donationTypeLabel": "Donation Type",
  "cashOption": "Cash",
  "goodsOption": "Goods",
  "amountLabel": "Amount (USD)",
  "goodsDescriptionLabel": "Description of Goods",
  "goodsDescriptionPlaceholder": "e.g., 1 computer, 5 blankets",
  "generateButton": "Save & Download PDF",
  "downloadButton": "Download PDF",
  "generatingButton": "Generating PDF...",
  "livePreviewTitle": "Live Preview",
  "historyTitle": "Receipt History",
  "searchDonorLabel": "Search by Donor Name",
  "searchDonorPlaceholder": "e.g., Jane Doe",
  "startDateLabel": "Start Date",
  "endDateLabel": "End Date",
  "minAmountLabel": "Min Amount",
  "minAmountPlaceholder": "0",
  "maxAmountLabel": "Max Amount",
  "maxAmountPlaceholder": "1000",
  "clearFiltersButton": "Clear Filters",
  "receiptIdHeader": "Receipt ID",
  "donorNameHeader": "Donor Name",
  "dateHeader": "Date",
  "amountHeader": "Amount",
  "actionsHeader": "Actions",
  "redownloadAction": "Re-download",
  "noReceiptsFound": "No receipts found.",
  "settingsTitle": "Organization Settings",
  "orgNameLabel": "Organization Name",
  "orgAddressLabel": "Organization Address",
  "orgEinLabel": "Organization EIN",
  "saveChangesButton": "Save Changes",
  "savedButton": "Saved!",
  "manageConfigFileTitle": "Manage Configuration File",
  "manageConfigFileDescription": "You can also manage your settings by uploading or downloading a `config.json` file. This is useful for backing up your settings or transferring them between devices.",
  "uploadConfigButton": "Upload config.json",
  "downloadTemplateButton": "Download Template",
  "configLoadSuccess": "Configuration loaded successfully!",
  "configLoadError": "Failed to load config file. Please check the file format.",
  "dbLoading": "Initializing Database...",
  "sharePanelTitle": "Receipt for {donorName} is ready!",
  "shareViaEmail": "Share via Email",
  "shareOnWhatsApp": "Share on WhatsApp",
  "shareMessage": "Please remember to attach the PDF receipt that was just downloaded.",
  "dismiss": "Dismiss"
};

const heTranslations: Translations = {
  "mainTitle": "מחולל קבלות תרומה",
  "mainSubtitle": "צור ונהל את קבלות התרומה שלך בקלות.",
  "createReceiptTab": "יצירת קבלה",
  "historyTab": "היסטוריית קבלות",
  "settingsTab": "הגדרות",
  "receiptDetailsTitle": "פרטי הקבלה",
  "donorNameLabel": "שם מלא של התורם",
  "donorAddressLabel": "כתובת מלאה של התורם",
  "donorEmailLabel": "אימייל של התורם",
  "donorPhoneLabel": "טלפון של התורם",
  "donationDateLabel": "תאריך התרומה",
  "donationTypeLabel": "סוג התרומה",
  "cashOption": "מזומן",
  "goodsOption": "שווה כסף",
  "amountLabel": "סכום (USD)",
  "goodsDescriptionLabel": "תיאור הטובין",
  "goodsDescriptionPlaceholder": "לדוגמה: מחשב אחד, 5 שמיכות",
  "generateButton": "שמור והורד PDF",
  "downloadButton": "הורד PDF",
  "generatingButton": "יוצר PDF...",
  "livePreviewTitle": "תצוגה מקדימה",
  "historyTitle": "היסטוריית קבלות",
  "searchDonorLabel": "חפש לפי שם תורם",
  "searchDonorPlaceholder": "לדוגמה: ישראל ישראלי",
  "startDateLabel": "תאריך התחלה",
  "endDateLabel": "תאריך סיום",
  "minAmountLabel": "סכום מינימלי",
  "minAmountPlaceholder": "0",
  "maxAmountLabel": "סכום מקסימלי",
  "maxAmountPlaceholder": "1000",
  "clearFiltersButton": "נקה מסננים",
  "receiptIdHeader": "מזהה קבלה",
  "donorNameHeader": "שם התורם",
  "dateHeader": "תאריך",
  "amountHeader": "סכום",
  "actionsHeader": "פעולות",
  "redownloadAction": "הורדה מחדש",
  "noReceiptsFound": "לא נמצאו קבלות.",
  "settingsTitle": "הגדרות ארגון",
  "orgNameLabel": "שם הארגון",
  "orgAddressLabel": "כתובת הארגון",
  "orgEinLabel": "מספר עמותה/ח\"פ",
  "saveChangesButton": "שמור שינויים",
  "savedButton": "נשמר!",
  "manageConfigFileTitle": "ניהול קובץ הגדרות",
  "manageConfigFileDescription": "ניתן גם לנהל את ההגדרות על ידי העלאה או הורדה של קובץ `config.json`. שימושי לגיבוי ההגדרות או להעברתן בין מכשירים.",
  "uploadConfigButton": "העלה קובץ config.json",
  "downloadTemplateButton": "הורד תבנית",
  "configLoadSuccess": "ההגדרות נטענו בהצלחה!",
  "configLoadError": "טעינת קובץ ההגדרות נכשלה. אנא בדוק את פורמט הקובץ.",
  "dbLoading": "מפעיל את מסד הנתונים...",
  "sharePanelTitle": "הקבלה עבור {donorName} מוכנה!",
  "shareViaEmail": "שתף באימייל",
  "shareOnWhatsApp": "שתף ב-WhatsApp",
  "shareMessage": "אנא זכור לצרף את קובץ ה-PDF של הקבלה שהורדת זה עתה.",
  "dismiss": "סגור"
};

const App: React.FC = () => {
  const [formData, setFormData] = useState<DonationData>({
    donorName: 'Jane Doe',
    donorAddress: '456 Giving St, Anytown, USA 12345',
    donorEmail: 'jane.doe@example.com',
    donorPhone: '123-456-7890',
    donationDate: new Date().toISOString().split('T')[0],
    donationAmount: 100,
    donationType: 'Cash',
    goodsDescription: '',
    receiptId: '...',
  });
  
  const [orgData, setOrgData] = useState<OrgData>({ name: '', address: '', ein: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [receiptHistory, setReceiptHistory] = useState<DonationData[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'settings'>('create');
  const [language, setLanguage] = useState<'en' | 'he'>(localStorage.getItem('appLanguage') as 'en' | 'he' || 'en');
  const [currentTranslations, setCurrentTranslations] = useState<Translations>({});
  
  const [donorSuggestions, setDonorSuggestions] = useState<Donor[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const autocompleteWrapperRef = useRef<HTMLDivElement>(null);

  const [lastGenerated, setLastGenerated] = useState<{ data: DonationData } | null>(null);

  const t = useCallback((key: string, replacements?: {[key: string]: string}): string => {
    let translation = currentTranslations[key] || key;
    if (replacements) {
        Object.keys(replacements).forEach(rKey => {
            translation = translation.replace(`{${rKey}}`, replacements[rKey]);
        });
    }
    return translation;
  }, [currentTranslations]);
  
  const loadInitialData = useCallback(async () => {
    if (!isPwaMode) {
      setIsDbLoading(false);
      const defaultOrgData = { name: "Generous Hearts Foundation", address: "123 Charity Lane, Philanthropy, TX 78701", ein: "12-3456789" };
      setOrgData(defaultOrgData);
      setFormData(prev => ({...prev, receiptId: 'RCPT-1001'}));
      return;
    };
    
    setIsDbLoading(true);
    try {
        console.log("[App] Attempting to initialize database...");
        await db.initDB();
        console.log("[App] Database initialization successful.");

        console.log("[App] Loading organization data...");
        const storedOrgData = await db.getOrgData();
        setOrgData(storedOrgData);
        console.log("[App] Organization data loaded.");
        
        console.log("[App] Loading receipt history...");
        const initialHistory = db.getReceipts({});
        setReceiptHistory(initialHistory);
        console.log(`[App] Receipt history loaded with ${initialHistory.length} items.`);

        console.log("[App] Calculating next receipt ID...");
        const nextReceiptId = await db.getNextReceiptIdString();
        setFormData(prev => ({...prev, receiptId: nextReceiptId}));
        console.log(`[App] Next receipt ID is ${nextReceiptId}.`);

    } catch (error) {
        console.error("[App] A critical error occurred during application startup in loadInitialData.", error);
        // The user can see the detailed error in the console.
    } finally {
        setIsDbLoading(false);
        console.log("[App] loadInitialData finished.");
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    localStorage.setItem('appLanguage', language);
    setCurrentTranslations(language === 'he' ? heTranslations : enTranslations);
  }, [language]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (autocompleteWrapperRef.current && !autocompleteWrapperRef.current.contains(event.target as Node)) {
            setIsDropdownVisible(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOrgDataChange = async (newOrgData: OrgData) => {
    setOrgData(newOrgData);
    if (isPwaMode) {
      await db.saveOrgData(newOrgData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setLastGenerated(null); // Hide share panel on form change
    
    let processedValue: string | number = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));

    if (name === 'donorName' && isPwaMode) {
      if (value.trim() === '') {
        setDonorSuggestions([]);
        setIsDropdownVisible(false);
      } else {
        const suggestions = db.getDonorsForAutocomplete(value);
        setDonorSuggestions(suggestions);
        setIsDropdownVisible(suggestions.length > 0);
      }
    }
  };

  const handleDonorSelect = (donor: Donor) => {
    setFormData(prev => ({
        ...prev,
        donorName: donor.name,
        donorAddress: donor.address,
        donorEmail: donor.email,
        donorPhone: donor.phone,
    }));
    setIsDropdownVisible(false);
    setDonorSuggestions([]);
  };

  const generatePdf = async (data: DonationData): Promise<File | null> => {
    const originalFormData = { ...formData };
    setFormData(data); // Temporarily set form data for preview rendering
    await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update

    const receiptElement = document.getElementById('receipt-preview');
    if (!receiptElement) {
      console.error('Receipt element not found!');
      setFormData(originalFormData); // Restore original form data
      return null;
    }

    try {
      const canvas = await html2canvas(receiptElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const pdfBlob = pdf.output('blob');
      const fileName = `donation-receipt-${data.receiptId}.pdf`;
      return new File([pdfBlob], fileName, { type: 'application/pdf' });

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Sorry, there was an error generating the PDF. Please try again.');
      return null;
    } finally {
      setFormData(originalFormData); // Always restore original form data
    }
  };

  const handleGenerateAndSavePdf = async () => {
    setIsLoading(true);
    setLastGenerated(null);
    const pdfFile = await generatePdf(formData);
    setIsLoading(false);

    if (pdfFile) {
        // Trigger download
        const url = URL.createObjectURL(pdfFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (isPwaMode) {
            await db.addReceipt(formData);
            db.saveLastReceiptNumber(formData.receiptId);
            
            const newReceiptId = await db.getNextReceiptIdString();
            
            setLastGenerated({ data: { ...formData } }); // Set data for share panel

            // Smart form reset
            setFormData(prev => ({
                ...prev, 
                donorName: '',
                donorAddress: '',
                donorEmail: '',
                donorPhone: '',
                donationAmount: '',
                goodsDescription: '',
                donationDate: new Date().toISOString().split('T')[0],
                receiptId: newReceiptId 
            }));

            const updatedHistory = db.getReceipts({});
            setReceiptHistory(updatedHistory);
        } else {
            setLastGenerated({ data: { ...formData } });
        }
    }
  };
  
  const handleRedownload = async (receipt: DonationData) => {
    setIsLoading(true);
    const pdfFile = await generatePdf(receipt);
    setIsLoading(false);

    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  
  const handleFilterChange = (filters: HistoryFilter) => {
      const newHistory = db.getReceipts(filters);
      setReceiptHistory(newHistory);
  };
  
  const cleanPhoneNumber = (phone: string) => {
    return phone.replace(/[^0-9+]/g, '');
  };

  const SharePanel = () => {
    if (!lastGenerated) return null;

    const { data } = lastGenerated;
    const emailSubject = `Donation Receipt from ${orgData.name}`;
    const emailBody = `Dear ${data.donorName},\n\nThank you for your generous donation. Please find your receipt attached to this email.\n\n${t('shareMessage')}\n\nSincerely,\n${orgData.name}`;
    const mailtoHref = `mailto:${data.donorEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    const whatsappText = `Hi ${data.donorName}, thank you for your donation to ${orgData.name}. I'm sending your receipt now. ${t('shareMessage')}`;
    const whatsappHref = `https://wa.me/${cleanPhoneNumber(data.donorPhone)}?text=${encodeURIComponent(whatsappText)}`;

    return (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-300 rounded-lg shadow-sm relative animate-fade-in">
             <button onClick={() => setLastGenerated(null)} className="absolute top-2 right-2 text-slate-500 hover:text-slate-800" aria-label={t('dismiss')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="font-semibold text-emerald-800 text-center mb-3">{t('sharePanelTitle', { donorName: data.donorName })}</h3>
            <p className="text-xs text-center text-slate-500 mb-4">{t('shareMessage')}</p>
            <div className="flex flex-col sm:flex-row gap-3">
                <a href={mailtoHref} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                    {t('shareViaEmail')}
                </a>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 text-center bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-4.134-3.32a.66.66 0 00-.913-.263l-4.59 2.45a.667.667 0 00-.28.532v2.88a.667.667 0 001.002.58l4.59-2.45a.667.667 0 00.28-.532V7.26a.66.66 0 00-.085-.38z" clipRule="evenodd" /></svg>
                    {t('shareOnWhatsApp')}
                </a>
            </div>
        </div>
    );
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

  if (isDbLoading && isPwaMode) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50 text-slate-700">
        <div className="flex items-center space-x-3">
           <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
          <span>{t('dbLoading')}</span>
        </div>
      </div>
    );
  }

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
                <div className="relative" ref={autocompleteWrapperRef}>
                  <FormField label={t('donorNameLabel')} id="donorName" name="donorName" type="text" value={formData.donorName} onChange={handleChange} required autoComplete="off" />
                  {isPwaMode && isDropdownVisible && donorSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg" role="listbox">
                      {donorSuggestions.map((donor) => (
                        <li
                          key={donor.id}
                          className="px-4 py-2 text-sm text-slate-700 cursor-pointer hover:bg-indigo-50"
                          onClick={() => handleDonorSelect(donor)}
                          role="option"
                          aria-selected="false"
                        >
                          <div className="font-medium">{donor.name}</div>
                          <div className="text-xs text-slate-500">{donor.email}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <FormField label={t('donorAddressLabel')} id="donorAddress" name="donorAddress" as="textarea" value={formData.donorAddress} onChange={handleChange} required />
                <FormField label={t('donorEmailLabel')} id="donorEmail" name="donorEmail" type="email" value={formData.donorEmail} onChange={handleChange} required />
                <FormField label={t('donorPhoneLabel')} id="donorPhone" name="donorPhone" type="tel" value={formData.donorPhone} onChange={handleChange} />
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
                <SharePanel />
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
          <ReceiptHistory receipts={receiptHistory} onRedownload={handleRedownload} onFilterChange={handleFilterChange} t={t} />
        )}

        {activeTab === 'settings' && (
          <Settings orgData={orgData} onOrgDataChange={handleOrgDataChange} t={t} />
        )}

      </div>
    </main>
  );
};

export default App;
