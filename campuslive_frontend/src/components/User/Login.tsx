import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import type { LoginCredentials } from '../../types';
import { Eye, EyeOff, User, Lock, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../toastContext';

interface LoginProps {
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const manageTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedTheme === 'dark' || (!savedTheme && systemDark);
    setIsDarkMode(shouldUseDark);
    document.documentElement.classList.toggle('dark', shouldUseDark);
  };

  useEffect(() => {
    manageTheme();
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!credentials.email || !credentials.password) {
      setError('Please fill in all fields');
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      const successLogin = await login(credentials);
      if (successLogin) {
        setSuccess('Login successful! Redirecting to map...');
        showToast('Login successful!...', 'success');
        setTimeout(() => {
          navigate('/map');
        }, 700);
      } else {
        const msg = 'Invalid email or password. Please try again.';
        setError(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      console.error('Login error:', err);
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900' : 'bg-gradient-to-br from-blue-50 via-teal-50 to-blue-100'}`}>
      <BackgroundEffects isDarkMode={isDarkMode} />
      <div className="relative flex items-center justify-center min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ThemeToggle isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        <div className="w-full max-w-md space-y-8">
          <Header isDarkMode={isDarkMode} />
          <MainCard
            isDarkMode={isDarkMode}
            credentials={credentials}
            showPassword={showPassword}
            error={error}
            success={success}
            isLoading={isLoading}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            setShowPassword={setShowPassword}
            onSwitchToRegister={onSwitchToRegister}
          />
          <Footer isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
};

const BackgroundEffects = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className={`absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse ${isDarkMode ? 'bg-blue-400' : 'bg-blue-300'}`} />
    <div className={`absolute top-3/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10 animate-pulse delay-1000 ${isDarkMode ? 'bg-teal-400' : 'bg-teal-300'}`} />
    <div className={`absolute bottom-1/4 left-1/2 w-48 h-48 rounded-full blur-3xl opacity-15 animate-pulse delay-500 ${isDarkMode ? 'bg-indigo-400' : 'bg-indigo-300'}`} />
  </div>
);

const ThemeToggle = ({ isDarkMode, toggleTheme }: { isDarkMode: boolean; toggleTheme: () => void }) => (
  <button
    onClick={toggleTheme}
    className={`fixed top-6 right-6 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50 ${isDarkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-white text-blue-600 hover:bg-gray-50'}`}
  >
    {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
  </button>
);

const Header = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="text-center">
    <div className="flex items-center justify-center mb-6">
      <div className="text-center">
        <img
          src="/src/assets/logo.png"
          alt="CampusLive Logo"
          className="mx-auto mb-0 w-48 h-auto"
        />
      </div>
    </div>
    <h1 className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>CampusLive</h1>
    <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Pan-Atlantic University</p>
    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sign in to explore campus events</p>
  </div>
);

const MainCard = ({
  isDarkMode,
  credentials,
  showPassword,
  error,
  success,
  isLoading,
  handleChange,
  handleSubmit,
  setShowPassword,
  onSwitchToRegister,
}: {
  isDarkMode: boolean;
  credentials: LoginCredentials;
  showPassword: boolean;
  error: string;
  success: string;
  isLoading: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  setShowPassword: (value: boolean) => void;
  onSwitchToRegister: () => void;
}) => (
  <div className={`backdrop-blur-sm rounded-3xl shadow-2xl p-8 transition-all duration-300 border ${isDarkMode ? 'bg-slate-800/90 border-slate-700 shadow-blue-900/20' : 'bg-white/90 border-white/20 shadow-blue-200/30'}`}>
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField
        label="Email Address"
        name="email"
        type="email"
        value={credentials.email}
        placeholder="yourname@pau.edu.ng"
        icon={<User className="h-5 w-5 text-gray-400" />}
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        handleChange={handleChange}
      />
      <FormField
        label="Password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        value={credentials.password}
        placeholder="Enter your password"
        icon={<Lock className="h-5 w-5 text-gray-400" />}
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        handleChange={handleChange}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
      />
      {error && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-red-900/50 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <p className="text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-green-900/50 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-700'}`}>
          <p className="text-sm">{success}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-offset-2 shadow-lg ${isDarkMode ? 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white focus:ring-blue-400/50 focus:ring-offset-slate-800 disabled:from-gray-600 disabled:to-gray-600' : 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white focus:ring-blue-400/50 focus:ring-offset-white disabled:from-gray-400 disabled:to-gray-400'} disabled:hover:scale-100 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
            Signing in...
          </div>
        ) : (
          'Sign In'
        )}
      </button>
      <div className="relative">
        <div className={`absolute inset-0 flex items-center ${isDarkMode ? 'text-gray-400' : 'text-gray-300'}`}>
          <div className={`w-full border-t ${isDarkMode ? 'border-slate-600' : 'border-gray-200'}`} />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className={`px-4 ${isDarkMode ? 'bg-slate-800 text-gray-400' : 'bg-white text-gray-500'}`}>New to CampusLive?</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onSwitchToRegister}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 border-2 hover:scale-[1.02] active:scale-[0.98] ${isDarkMode ? 'border-slate-600 text-blue-300 hover:bg-slate-700/50 hover:border-blue-400' : 'border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300'}`}
      >
        Create New Account
      </button>
    </form>
  </div>
);

const FormField = ({
  label,
  name,
  type,
  value,
  placeholder,
  icon,
  isDarkMode,
  isLoading,
  handleChange,
  showPassword,
  setShowPassword,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
  placeholder: string;
  icon: React.ReactNode;
  isDarkMode: boolean;
  isLoading: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showPassword?: boolean;
  setShowPassword?: (value: boolean) => void;
}) => (
  <div className="space-y-2">
    <label htmlFor={name} className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">{icon}</div>
      <input
        id={name}
        name={name}
        type={type}
        required
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-teal-400/20 focus:ring-offset-slate-800' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20 focus:ring-offset-white'} disabled:cursor-not-allowed`}
        disabled={isLoading}
      />
      {setShowPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
        >
          {showPassword ? <EyeOff className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} /> : <Eye className={`h-5 w-5 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />}
        </button>
      )}
    </div>
  </div>
);

const Footer = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="text-center">
    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Campus location: Km 52 Lekki - Epe Expressway, Lagos</p>
  </div>
);

export default Login;