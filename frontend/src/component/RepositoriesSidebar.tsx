import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from './RepositoriesSidebar.module.css';

export interface Repository {
  id: string | number;
  owner: string;
  name: string;
  avatarUrl?: string;
}

interface RepositoriesSidebarProps {
  onNewRepository?: () => void;
}

// تحديد عنوان الـ API ديناميكيًا حسب البيئة
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8080' 
  : 'https://gitport.onrender.com';

export const RepositoriesSidebar: React.FC<RepositoriesSidebarProps> = ({ onNewRepository }) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserDataAndRepos = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      let username: string | null = null;

      // 1. استخراج واكتشاف اسم المستخدم الحالي أولاً
      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.user?.username) {
              username = data.user.username;
            }
          }
        } catch (e) {
          console.error('Failed to get user info from /me endpoint', e);
        }

        // Fallback: فك تشفير التوكن يدوياً في حال فشل طلب /me
        if (!username) {
          try {
            const payloadBase64 = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payloadBase64));
            if (decodedPayload.username) {
              username = decodedPayload.username;
            }
          } catch (err) {
            console.error('Error parsing token payload:', err);
          }
        }
      }

      // 2. جلب المستودعات وفلترتها مباشرة قبل إنهاء التحميل
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/repositories`, { headers });

        if (response.ok) {
          const data: Repository[] = await response.json();
          
          if (username) {
            // تصفية المستودعات بحيث تقتصر على مستودعات المستخدم فقط
            const userRepos = data.filter(
              (repo) => repo.owner.toLowerCase() === username.toLowerCase()
            );
            setRepositories(userRepos);
          } else {
            setRepositories(data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch repositories:', err);
      } finally {
        setLoading(false); // لا يتم إيقاف التحميل إلا بعد إتمام عملية التصفية
      }
    };

    fetchUserDataAndRepos();
  }, []);

  const handleNewRepoClick = () => {
    if (onNewRepository) {
      onNewRepository();
    } else {
      navigate('/NewRepository');
    }
  };

  const renderFallbackAvatar = (owner: string) => {
    const firstLetter = owner ? owner.charAt(0).toUpperCase() : 'R';
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="#2da44e" rx="20"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="50" font-weight="bold" font-family="sans-serif">${firstLetter}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  };

  const filteredRepos = repositories.filter(repo =>
    `${repo.owner}/${repo.name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedRepos = showAll ? filteredRepos : filteredRepos.slice(0, 7);

  return (
    <aside className={styles.sidebarContainer}>
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Top repositories</h2>
        <button 
          className={styles.btnNewRepo} 
          onClick={handleNewRepoClick}
          type="button"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-11h-8a1 1 0 0 0-1 1V14a1 1 0 0 0 1 1h2.25a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 14V2.5z"></path>
            <path d="M7.75 7.75V5.5a.75.75 0 0 1 1.5 0v2.25H11.5a.75.75 0 0 1 0 1.5H9.25v2.25a.75.75 0 0 1-1.5 0V9.25H5.5a.75.75 0 0 1 0-1.5h2.25z"></path>
          </svg>
          New
        </button>
      </div>

      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Find a repository..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className={styles.emptyState}>Loading...</div>
      ) : displayedRepos.length > 0 ? (
        <ul className={styles.repoList}>
          {displayedRepos.map((repo) => (
            <li key={repo.id} className={styles.repoItem}>
              <img 
                src={repo.avatarUrl || renderFallbackAvatar(repo.owner)} 
                alt={repo.owner} 
                className={styles.repoAvatar} 
              />
              <Link to={`/${repo.owner}/${repo.name}`} className={styles.repoLink}>
                <span className={styles.repoOwner}>{repo.owner}/</span>
                <span className={styles.repoName}>{repo.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.emptyState}>
          No repositories found.
        </div>
      )}

      {!showAll && filteredRepos.length > 7 && (
        <button 
          className={styles.showMoreBtn} 
          onClick={() => setShowAll(true)}
          type="button"
        >
          Show more
        </button>
      )}
    </aside>
  );
};

export default RepositoriesSidebar;