import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import type { RegisterData } from '../../types';
import { Eye, EyeOff, User, Lock, Mail, UserCheck, Moon, Sun } from 'lucide-react';
import { useTheme, useFormValidation, getInputStyles, getPasswordInputStyles, getPasswordStrengthColor, getPasswordStrengthText, getPasswordStrengthBarColor } from '../../utils/useRegisterUtils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../toastContext';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

const PasswordStrengthIndicator: React.FC<{
  password: string;
  isDarkMode: boolean;
  getPasswordStrength: (password: string) => number;
}> = ({ password, isDarkMode, getPasswordStrength }) => {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const strengthColor = getPasswordStrengthColor(strength);
  const strengthText = getPasswordStrengthText(strength);

  return (
    <div className="mt-2">
      <div className="flex space-x-1 mb-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={`strength-bar-${index}`}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${getPasswordStrengthBarColor(strength, index, isDarkMode)}`}
          />
        ))}
      </div>
      <p className={`text-xs ${strengthColor}`}>
        Password strength: {strengthText}
      </p>
    </div>
  );
};

interface InputFieldProps {
  id: string;
  name: string;
  type: string;
  label: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  error?: string;
  isDarkMode: boolean;
  isLoading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputField: React.FC<InputFieldProps> = ({
  id,
  name,
  type,
  label,
  value,
  placeholder,
  icon,
  error,
  isDarkMode,
  isLoading,
  onChange
}) => (
  <div className="space-y-2">
    <label htmlFor={id} className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <div className="text-gray-400">
          {icon}
        </div>
      </div>
      <input
        id={id}
        name={name}
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={getInputStyles(isDarkMode, !!error)}
        disabled={isLoading}
      />
    </div>
    {error && (
      <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
        {error}
      </p>
    )}
  </div>
);

interface PasswordInputProps {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  isDarkMode: boolean;
  isLoading: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showStrengthIndicator?: boolean;
  getPasswordStrength?: (password: string) => number;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  name,
  label,
  value,
  placeholder,
  error,
  isDarkMode,
  isLoading,
  showPassword,
  onTogglePassword,
  onChange,
  showStrengthIndicator = false,
  getPasswordStrength
}) => (
  <div className="space-y-2">
    <label htmlFor={id} className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Lock className="h-5 w-5 text-gray-400" />
      </div>
      <input
        id={id}
        name={name}
        type={showPassword ? 'text' : 'password'}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={getPasswordInputStyles(isDarkMode, !!error)}
        disabled={isLoading}
      />
      <button
        type="button"
        onClick={onTogglePassword}
        className="absolute inset-y-0 right-0 pr-3 flex items-center"
      >
        {showPassword ? (
          <EyeOff className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
        ) : (
          <Eye className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
        )}
      </button>
    </div>

    {showStrengthIndicator && getPasswordStrength && (
      <PasswordStrengthIndicator
        password={value}
        isDarkMode={isDarkMode}
        getPasswordStrength={getPasswordStrength}
      />
    )}

    {error && (
      <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
        {error}
      </p>
    )}
  </div>
);

const RegisterHeader: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div className="text-center">
    <div className="flex items-center justify-center mb-0">
      <div className="text-center">
        <img
          src="/src/assets/logo.png"
          alt="CampusLive Logo"
          className="mx-auto mb-0 w-48 h-auto"
        />
      </div>
    </div>
    <h1 className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      Join CampusLive
    </h1>
    <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-teal-300' : 'text-teal-700'}`}>
      Pan-Atlantic University
    </p>
    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
      Create your account to get started
    </p>
  </div>
);

const RegisterFooter: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div className="text-center">
    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      By creating an account, you agree to use CampusLive responsibly
    </p>
  </div>
);

const RegisterForm: React.FC<{
  formData: RegisterData;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  errors: Record<string, string>;
  isDarkMode: boolean;
  isLoading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onConfirmPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  getPasswordStrength: (password: string) => number;
}> = ({
  formData,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  errors,
  isDarkMode,
  isLoading,
  onChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onToggleConfirmPassword,
  onSubmit,
  getPasswordStrength
}) => (
    <form onSubmit={onSubmit} className="space-y-6">
      <InputField
        id="email"
        name="email"
        type="email"
        label="Email Address *"
        value={formData.email}
        placeholder="yourname@pau.edu.ng"
        icon={<Mail className="h-5 w-5" />}
        error={errors.email}
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        onChange={onChange}
      />

      <InputField
        id="username"
        name="username"
        type="text"
        label="Username *"
        value={formData.username}
        placeholder="Choose a username"
        icon={<User className="h-5 w-5" />}
        error={errors.username}
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        onChange={onChange}
      />

      <div className="space-y-2">
        <label htmlFor="role" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          Role
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <UserCheck className="h-5 w-5 text-gray-400" />
          </div>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={onChange}
            className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${isDarkMode
              ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-400 focus:ring-teal-400/20 focus:ring-offset-slate-800'
              : 'bg-white border-gray-200 text-gray-900 focus:border-teal-500 focus:ring-teal-500/20 focus:ring-offset-white'
              }`}
            disabled={isLoading}
          >
            <option value="STUDENT">Student</option>
            <option value="FACULTY">Faculty</option>
          </select>
        </div>
      </div>

      <PasswordInput
        id="password"
        name="password"
        label="Password *"
        value={formData.password}
        placeholder="Create a strong password"
        error={errors.password}
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        showPassword={showPassword}
        onTogglePassword={onTogglePassword}
        onChange={onChange}
        showStrengthIndicator={true}
        getPasswordStrength={getPasswordStrength}
      />

      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm Password *"
        value={confirmPassword}
        placeholder="Confirm your password"
        error={errors.confirmPassword}
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        showPassword={showConfirmPassword}
        onTogglePassword={onToggleConfirmPassword}
        onChange={onConfirmPasswordChange}
      />

      {errors.success && (
        <div className={`p-4 rounded-xl border ${isDarkMode
          ? 'bg-green-900/50 border-green-800 text-green-300'
          : 'bg-green-50 border-green-200 text-green-700'
          }`}>
          <p className="text-sm">{errors.success}</p>
        </div>
      )}

      {errors.general && (
        <div className={`p-4 rounded-xl border ${isDarkMode
          ? 'bg-red-900/50 border-red-800 text-red-300'
          : 'bg-red-50 border-red-200 text-red-700'
          }`}>
          <p className="text-sm">{errors.general}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-offset-2 shadow-lg ${isDarkMode
          ? 'bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white focus:ring-teal-400/50 focus:ring-offset-slate-800 disabled:from-gray-600 disabled:to-gray-600'
          : 'bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white focus:ring-teal-400/50 focus:ring-offset-white disabled:from-gray-400 disabled:to-gray-400'
          } disabled:hover:scale-100 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
            Creating account...
          </div>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );

const LoginLink: React.FC<{ isDarkMode: boolean; onSwitchToLogin: () => void }> = ({ isDarkMode, onSwitchToLogin }) => (
  <>
    <div className="relative mt-6">
      <div className={`absolute inset-0 flex items-center ${isDarkMode ? 'text-gray-400' : 'text-gray-300'}`}>
        <div className={`w-full border-t ${isDarkMode ? 'border-slate-600' : 'border-gray-200'}`} />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className={`px-4 ${isDarkMode ? 'bg-slate-800 text-gray-400' : 'bg-white text-gray-500'}`}>
          Already have an account?
        </span>
      </div>
    </div>
    <button
      onClick={onSwitchToLogin}
      className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 border-2 hover:scale-[1.02] active:scale-[0.98] mt-6 ${isDarkMode
        ? 'border-slate-600 text-teal-300 hover:bg-slate-700/50 hover:border-teal-400'
        : 'border-gray-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300'
        }`}
    >
      Sign In Instead
    </button>
  </>
);

const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    username: '',
    password: '',
    role: 'STUDENT'
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { register, isLoading } = useAuthStore();
  const { isDarkMode, toggleTheme } = useTheme();
  const { validateForm, getPasswordStrength } = useFormValidation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validateForm(formData, confirmPassword);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // show first validation error as a toast
      const firstKey = Object.keys(validationErrors)[0];
      showToast(validationErrors[firstKey], 'error');
      return;
    }

    try {
      const success = await register(formData);
      if (success) {
        setErrors({ success: 'Registration successful! Welcome to CampusLive. Redirecting...' });
        showToast('Registration successful! Welcome to CampusLive.', 'success');
        setTimeout(() => {
          navigate('/map');
        }, 900);
      } else {
        const msg = 'Registration failed. Please try again.';
        setErrors({ general: msg });
        showToast(msg, 'error');
      }
    } catch (err) {
      console.error('Registration error:', err);
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      // map to field or general message as you already do
      const errorMessageLower = (message || '').toLowerCase();
      if (errorMessageLower.includes('email') || errorMessageLower.includes('pau.edu.ng')) {
        setErrors((p) => ({ ...p, email: message }));
      } else if (errorMessageLower.includes('username')) {
        setErrors((p) => ({ ...p, username: message }));
      } else if (errorMessageLower.includes('password')) {
        setErrors((p) => ({ ...p, password: message }));
      } else if (errorMessageLower.includes('already exists')) {
        setErrors((p) => ({ ...p, general: 'An account with this email or username already exists.' }));
      } else {
        setErrors((p) => ({ ...p, general: message }));
      }
      showToast(message, 'error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear the specific field error and general error when user starts typing
    setErrors(prev => ({ ...prev, [name]: '', general: '', success: '' }));
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setErrors(prev => ({ ...prev, confirmPassword: '', general: '', success: '' }));
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode
      ? 'bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900'
      : 'bg-gradient-to-br from-teal-50 via-blue-50 to-teal-100'
      }`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-20 animate-pulse delay-300 ${isDarkMode ? 'bg-teal-400' : 'bg-teal-300'}`} />
        <div className={`absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10 animate-pulse delay-700 ${isDarkMode ? 'bg-blue-400' : 'bg-blue-300'}`} />
        <div className={`absolute top-3/4 right-1/2 w-64 h-64 rounded-full blur-3xl opacity-15 animate-pulse delay-1000 ${isDarkMode ? 'bg-emerald-400' : 'bg-emerald-300'}`} />
      </div>

      <div className="relative flex items-center justify-center min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={toggleTheme}
          className={`fixed top-6 right-6 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50 ${isDarkMode
            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
            : 'bg-white text-teal-600 hover:bg-gray-50'
            }`}
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="w-full max-w-md space-y-8">
          <RegisterHeader isDarkMode={isDarkMode} />
          <div className={`backdrop-blur-sm rounded-3xl shadow-2xl p-8 transition-all duration-300 border ${isDarkMode
            ? 'bg-slate-800/90 border-slate-700 shadow-teal-900/20'
            : 'bg-white/90 border-white/20 shadow-teal-200/30'
            }`}>
            <RegisterForm
              formData={formData}
              confirmPassword={confirmPassword}
              showPassword={showPassword}
              showConfirmPassword={showConfirmPassword}
              errors={errors}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              onChange={handleChange}
              onConfirmPasswordChange={handleConfirmPasswordChange}
              onTogglePassword={() => setShowPassword(!showPassword)}
              onToggleConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
              onSubmit={handleSubmit}
              getPasswordStrength={getPasswordStrength}
            />
            <LoginLink isDarkMode={isDarkMode} onSwitchToLogin={onSwitchToLogin} />
          </div>
          <RegisterFooter isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
};

export default Register;