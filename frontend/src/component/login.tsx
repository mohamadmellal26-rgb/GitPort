import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import styles from './Login.module.css';

// تحديد عنوان الـ API تلقائياً بناءً على بيئة التشغيل
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8080' 
  : 'https://gitport.onrender.com'; // ضع رابط سيرفرك على Render هنا

export const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername || !password || (isSignUp && !cleanEmail)) {
      setError('الرجاء إدخال جميع الحقول المطلوبة.');
      return;
    }

    if (isSignUp) {
      if (cleanUsername.length < 3) {
        setError('اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.');
        return;
      }

      if (password.length < 6) {
        setError('كلمة المرور يجب ألا تقل عن 6 أحرف.');
        return;
      }

      const usernameRegex = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
      if (!usernameRegex.test(cleanUsername)) {
        setError('اسم المستخدم يجب أن يحتوي فقط على أحرف إنجليزية، أرقام، أو شرطة (-)، بدون مسافات أو رموز خاصة مثل (#, ?, /).');
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = isSignUp 
        ? `${API_BASE_URL}/api/v1/register` 
        : `${API_BASE_URL}/api/v1/login`;

      // تجهيز البيانات المرسلة (إرسال الإيميل فقط في حالة التسجيل إذا كان السيرفر يطلبه)
      const requestBody: any = {
        username: cleanUsername,
        password: password,
      };

      if (isSignUp) {
        requestBody.email = cleanEmail;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء الاتصال بالسيرفر');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (checkAuth) {
          await checkAuth();
        }
        
        navigate('/', { replace: true });
      } else {
        throw new Error('لم يتم استلام رمز المصادقة من السيرفر');
      }

    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالسيرفر');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginHeader}>
        <svg className={styles.logo} viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v10" />
          <path d="M5 12h14" />
          <path d="M5 12a7 7 0 0 0 14 0" />
          <circle cx="5" cy="12" r="1.5" fill="#f97316" />
          <circle cx="19" cy="12" r="1.5" fill="#f97316" />
        </svg>
        <h1 className={styles.title}>
          {isSignUp ? 'Sign up to GitPort' : 'Sign in to GitPort'}
        </h1>
      </div>

      <div className={styles.loginCard}>
        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Username {isSignUp ? '' : 'or email address'}
            </label>
            <input
              type="text"
              id="username"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          {isSignUp && (
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email address
              </label>
              <input
                type="email"
                id="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              {!isSignUp && (
                <button 
                  type="button" 
                  onClick={() => alert('Forgot password feature coming soon!')} 
                  className={styles.forgotLink}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              type="password"
              id="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading}
          >
            {isLoading
              ? isSignUp
                ? 'Creating account...'
                : 'Signing in...'
              : isSignUp
              ? 'Create account'
              : 'Sign in'}
          </button>
        </form>
      </div>

      <div className={styles.createAccountCard}>
        {isSignUp ? (
          <>
            Already have an account?{' '}
            <button type="button" onClick={toggleMode} className={styles.toggleBtn}>
              Sign in
            </button>
            .
          </>
        ) : (
          <>
            New to GitPort?{' '}
            <button type="button" onClick={toggleMode} className={styles.toggleBtn}>
              Create an account
            </button>
            .
          </>
        )}
      </div>
    </div>
  );
};

export default Login;