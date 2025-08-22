import React from 'react';

interface FormFieldProps {
  label: string;
  id: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  required?: boolean;
  as?: 'input' | 'textarea' | 'select';
  options?: string[];
  rows?: number;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  as = 'input',
  options = [],
  rows = 3
}) => {
  const commonProps = {
    id,
    name,
    value,
    onChange,
    placeholder,
    required,
    className: 'mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none invalid:border-pink-500 invalid:text-pink-600 focus:invalid:border-pink-500 focus:invalid:ring-pink-500'
  };

  const renderInput = () => {
    switch (as) {
      case 'textarea':
        return <textarea {...commonProps} rows={rows}></textarea>;
      case 'select':
        return (
          <select {...commonProps}>
            {options && options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      default:
        return <input type={type} {...commonProps} />;
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {renderInput()}
    </div>
  );
};

export default FormField;
