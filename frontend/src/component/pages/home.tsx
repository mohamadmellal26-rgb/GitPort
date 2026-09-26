import React from 'react';
import Header from '../Header';
import RepositoriesSidebar from '../RepositoriesSidebar';
import Feed from '../Feed';
import "./home.css";

export const Home: React.FC = () => {
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