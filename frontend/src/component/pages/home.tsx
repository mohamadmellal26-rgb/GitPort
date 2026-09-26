import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import RepositoriesSidebar from '../RepositoriesSidebar';
import Feed from '../Feed';
import "./home.css";

export const Home: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

    if (!isAuthenticated) {
      navigate('/login', { replace: true });
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