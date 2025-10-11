import React, { useState, useEffect } from 'react';
import { OrgData } from '../types';
import FormField from './FormField';

interface SettingsProps {
  orgData: OrgData;
  onOrgDataChange: (data: OrgData) => void;
  t: (key: string) => string;
}

const Settings: React.FC<SettingsProps> = ({ orgData, onOrgDataChange, t }) => {
  const [localOrgData, setLocalOrgData] = useState<OrgData>(orgData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setLocalOrgData(orgData);
  }, [orgData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLocalOrgData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    onOrgDataChange(localOrgData);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsedData = JSON.parse(content);
          // Basic validation to ensure keys exist
          if (parsedData.name && parsedData.address && parsedData.ein) {
            onOrgDataChange(parsedData);
            setSaveStatus('success');
            alert(t('configLoadSuccess'));
            setTimeout(() => setSaveStatus('idle'), 3000);
          } else {
            throw new Error("Invalid config file format. Required keys are: name, address, ein.");
          }
        } catch (error) {
          console.error("[Settings] Error parsing config file:", {
            fileName: file.name,
            error: error instanceof Error ? error.message : String(error)
          });
          alert(`${t('configLoadError')} ${error instanceof Error ? error.message : ''}`);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
        }
      };
      reader.onerror = (error) => {
        console.error('[Settings] FileReader error:', error);
        alert('Failed to read the selected file.');
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadTemplate = () => {
    const template: OrgData = {
      name: "Your Organization Name",
      address: "123 Main Street, City, State ZIP",
      ein: "XX-XXXXXXX"
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-slate-700 mb-6 border-b pb-3">{t('settingsTitle')}</h2>
      
      {/* Manual Edit Form */}
      <form className="space-y-4" onSubmit={handleSaveChanges}>
        <FormField label={t('orgNameLabel')} id="name" name="name" value={localOrgData.name} onChange={handleChange} required />
        <FormField label={t('orgAddressLabel')} id="address" name="address" as="textarea" value={localOrgData.address} onChange={handleChange} required />
        <FormField label={t('orgEinLabel')} id="ein" name="ein" value={localOrgData.ein} onChange={handleChange} required />

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 transition-colors duration-200"
          >
            {saveStatus === 'success' ? t('savedButton') : t('saveChangesButton')}
          </button>
        </div>
      </form>

      {/* File Management Section */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">{t('manageConfigFileTitle')}</h3>
        <p className="text-sm text-slate-500 mb-4">
          {t('manageConfigFileDescription')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="w-full sm:w-auto flex-1 cursor-pointer text-center bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2 px-4 border border-slate-300 rounded-lg shadow-sm transition-colors">
            <span>{t('uploadConfigButton')}</span>
            <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
          </label>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="w-full sm:w-auto flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
          >
            {t('downloadTemplateButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;