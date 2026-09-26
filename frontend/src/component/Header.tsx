import React, { useState, useRef, useEffect } from 'react';
import './Header.css';
import { Menu, Search, Plus, CircleDot, GitPullRequest, Bookmark, Inbox, ChevronDown, Bot, LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  username?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ username = 'User', onLogout }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة المنسدلة عند النقر في أي مكان خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    // 1. مسح التوكن وبيانات الجلسة من LocalStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // 2. إذا تم تمرير دالة custom لـ logout
    if (onLogout) {
      onLogout();
    } else {
      // 3. التوجيه لصفحة تسجيل الدخول وتحديث الصفحة
      window.location.href = '/login';
    }
  };

  return (
    <header className="github-header">
      {/* اليسار */}
      <div className="header-section">
        <button className="btn-icon" aria-label="Toggle Menu">
          <Menu size={16} />
        </button>
        
        {/* شعار GitPort البرتقالي الـ SVG */}
        <a href="/" className="gitport-logo-link" title="GitPort">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#orange-gradient)" />
            <path 
              d="M16 7V21M16 21C13.2386 21 11 18.7614 11 16M16 21C18.7614 21 21 18.7614 21 16" 
              stroke="white" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <circle cx="16" cy="8" r="2" fill="white" />
            <circle cx="9" cy="15" r="2" fill="white" />
            <circle cx="23" cy="15" r="2" fill="white" />
            <path d="M13 25H19" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            <defs>
              <linearGradient id="orange-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6B00" />
                <stop offset="1" stopColor="#D94800" />
              </linearGradient>
            </defs>
          </svg>
          <span className="gitport-logo-text">GitPort</span>
        </a>
      </div>

      {/* اليمين */}
      <div className="header-section">
        <div className="search-box">
          <Search size={14} color="#7d8590" />
          <input className="search-input" type="text" placeholder="Type / to search" />
          <span className="shortcut-badge">/</span>
        </div>

        <div className="btn-group">
          <button aria-label="Copilot Assistant"><Bot size={16} /></button>
          <div className="btn-divider" />
          <button aria-label="More Copilot Options"><ChevronDown size={12} /></button>
        </div>

        <div className="vertical-separator" />

        <div className="btn-group">
          <button aria-label="Create New"><Plus size={16} /></button>
          <div className="btn-divider" />
          <button aria-label="More Creation Options"><ChevronDown size={12} /></button>
        </div>

        <button className="btn-icon" aria-label="Issues"><CircleDot size={16} /></button>
        <button className="btn-icon" aria-label="Pull Requests"><GitPullRequest size={16} /></button>
        <button className="btn-icon" aria-label="Bookmarks"><Bookmark size={16} /></button>
        <button className="btn-icon" aria-label="Notifications"><Inbox size={16} /></button>

        {/* زر البروفايل مع القائمة المنسدلة */}
        <div className="profile-dropdown-container" ref={dropdownRef}>
          <button 
            className="avatar-btn" 
            aria-label="User Profile" 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <img src={`https://github.com/identicons/${username}.png`} alt="Avatar" />
          </button>

          {isProfileOpen && (
            <div className="profile-menu">
              <div className="profile-header-info">
                <span className="signed-in-text">Signed in as</span>
                <strong className="profile-username">{username}</strong>
              </div>
              <div className="menu-divider" />
              
              <a href={`/${username}`} className="menu-item">
                <UserIcon size={14} />
                <span>Your profile</span>
              </a>

              <div className="menu-divider" />

              <button className="menu-item logout-btn" onClick={handleLogout}>
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;