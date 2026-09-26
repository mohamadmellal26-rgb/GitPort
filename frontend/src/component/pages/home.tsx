import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import RepositoriesSidebar from '../RepositoriesSidebar';
import Feed from '../Feed';
import "./home.css";

export const Home: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // التحقق من وجود رمز المصادقة أو حالة تسجيل الدخول من localStorage
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true'; // أو التاكد من وجود token مثل: localStorage.getItem('token')

    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <>
      <Header />
      <div className="appBody">
        <RepositoriesSidebar />
        <main className="mainContent">
          <Feed />
        </main>
      </div>
    </>
  );
};

export default Home;