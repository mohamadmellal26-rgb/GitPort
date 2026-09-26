import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Header.css';
import { Menu, Search, Plus, CircleDot, GitPullRequest, Bookmark, Inbox, ChevronDown, Bot, LogOut, User as UserIcon, FolderGit2 } from 'lucide-react';

interface HeaderProps {
  username?: string;
  onLogout?: () => void;
}

interface Repository {
  id: string | number;
  owner: string;
  name: string;
  is_private?: boolean;
}

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8080' 
  : 'https://gitport.onrender.com';

export const Header: React.FC<HeaderProps> = ({ username = 'User', onLogout }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Repository[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // إغلاق القوائم المنسدلة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // دالة البحث المباشر عن مستودعات المستخدمين الآخرين
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/api/v1/repositories`, { headers });
        if (response.ok) {
          const data: Repository[] = await response.json();
          const filtered = data.filter(repo =>
            `${repo.owner}/${repo.name}`.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Error searching repositories:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      fetchSearchResults();
    }, 300); // Debounce لتخفيف الطلبات على السيرفر

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/login';
    }
  };

  const handleSelectRepo = (owner: string, repoName: string) => {
    setShowSearchResults(false);
    setSearchQuery('');
    navigate(`/${owner}/${repoName}`);
  };

  return (
    <header className="github-header">
      {/* اليسار */}
      <div className="header-section">
        <button className="btn-icon" aria-label="Toggle Menu">
          <Menu size={16} />
        </button>
        
        {/* شعار GitPort البرتقالي الـ SVG */}
        <Link to="/" className="gitport-logo-link" title="GitPort">
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
        </Link>
      </div>

      {/* اليمين */}
      <div className="header-section">
        {/* مربع البحث التفاعلي */}
        <div className="search-box-container" ref={searchRef} style={{ position: 'relative' }}>
          <div className="search-box">
            <Search size={14} color="#7d8590" />
            <input 
              className="search-input" 
              type="text" 
              placeholder="Search repositories..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchResults(true)}
            />
            <span className="shortcut-badge">/</span>
          </div>

          {/* قائمة نتائج البحث المنسدلة */}
          {showSearchResults && searchQuery.trim() !== '' && (
            <div className="search-results-dropdown" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '6px',
              background: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              boxShadow: '0 8px 24px rgba(140,149,159,0.2)',
              zIndex: 100,
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {isSearching ? (
                <div style={{ padding: '12px', textAlign: 'center', color: '#57606a', fontSize: '13px' }}>
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {searchResults.map((repo) => {
                    const isMine = repo.owner.toLowerCase() === username.toLowerCase();
                    return (
                      <li 
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo.owner, repo.name)}
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid #f0f0f0',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px'
                        }}
                      >
                        <FolderGit2 size={16} color="#57606a" />
                        <span style={{ color: '#0969da', fontWeight: 'bold' }}>
                          {repo.owner}/{repo.name}
                        </span>
                        {!isMine && (
                          <span style={{ fontSize: '10px', background: '#f6f8fa', border: '1px solid #d0d7de', padding: '1px 5px', borderRadius: '4px', marginLeft: 'auto', color: '#57606a' }}>
                            Read Only
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', color: '#57606a', fontSize: '13px' }}>
                  No repositories found
                </div>
              )}
            </div>
          )}
        </div>

        <div className="btn-group">
          <button aria-label="Copilot Assistant"><Bot size={16} /></button>
          <div className="btn-divider" />
          <button aria-label="More Copilot Options"><ChevronDown size={12} /></button>
        </div>

        <div className="vertical-separator" />

        <div className="btn-group">
          <button aria-label="Create New" onClick={() => navigate('/NewRepository')}><Plus size={16} /></button>
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
              
              <Link to={`/${username}`} className="menu-item" onClick={() => setIsProfileOpen(false)}>
                <UserIcon size={14} />
                <span>Your profile</span>
              </Link>

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