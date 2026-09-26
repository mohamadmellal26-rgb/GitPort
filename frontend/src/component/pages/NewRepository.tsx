import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NewRepository.module.css';
import Header from '../Header';

export const NewRepository: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string>('');
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [addReadme, setAddReadme] = useState(false);
  const [gitignore, setGitignore] = useState('None');
  const [license, setLicense] = useState('None');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // جلب اسم المستخدم الحقيقي من السيرفر مباشرة لتفادي عدم التطابق مع التوكن
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch('http://localhost:8080/api/v1/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user?.username) {
            setCurrentUser(data.user.username);
            return;
          }
        }
      } catch (err) {
        console.error('فشل جلب بيانات المستخدم الحالية:', err);
      }

      // fallback في حال تعذر الاتصال بالـ me endpoint
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed?.username) {
            setCurrentUser(parsed.username);
          }
        } catch (e) {
          setCurrentUser(savedUser);
        }
      }
    };

    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName.trim()) {
      setError('Please enter a repository name.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('غير مخول، يجب تسجيل الدخول أولاً');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8080/api/v1/repositories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: repoName.trim(),
          description,
          is_private: visibility === 'private',
          add_readme: addReadme,
          gitignore,
          license,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create repository');
      }

      // اعتماد الـ owner الراجع من الباك إند لمنع الـ 404
      const realOwner = data.repository?.owner || currentUser;
      const realName = data.repository?.name || repoName.trim();

      navigate(`/${realOwner}/${realName}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', width: '100%', display: 'block' }}>
      <Header />
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Create a new repository</h1>
          <p className={styles.subtitle}>
            Repositories contain a project's files and version history.
          </p>
        </header>

        {error && <div className={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Step 1: General */}
          <section className={styles.section}>
            <div className={styles.stepBadge}>1</div>
            <div className={styles.sectionContent}>
              <h2 className={styles.sectionTitle}>General</h2>

              <div className={styles.ownerRepoRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Owner *</label>
                  <div className={styles.ownerBadge}>
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser || 'default')}`}
                      alt="Owner Avatar"
                      className={styles.avatar}
                    />
                    <span>{currentUser || 'Loading...'}</span>
                  </div>
                </div>

                <span className={styles.slash}>/</span>

                <div className={styles.formGroupFlex}>
                  <label className={styles.label}>Repository name *</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="e.g. gitport-app"
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Description</label>
                <input
                  type="text"
                  className={styles.input}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={350}
                />
                <span className={styles.charCount}>
                  {description.length} / 350 characters
                </span>
              </div>
            </div>
          </section>

          {/* Step 2: Configuration */}
          <section className={styles.section}>
            <div className={styles.stepBadge}>2</div>
            <div className={styles.sectionContent}>
              <h2 className={styles.sectionTitle}>Configuration</h2>

              <div className={styles.configCard}>
                <div className={styles.configRow}>
                  <div>
                    <div className={styles.configTitle}>Choose visibility *</div>
                    <div className={styles.configDesc}>
                      Choose who can see and commit to this repository
                    </div>
                  </div>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className={styles.select}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div className={styles.configRow}>
                  <div>
                    <div className={styles.configTitle}>Add README</div>
                    <div className={styles.configDesc}>
                      READMEs can be used as longer descriptions.
                    </div>
                  </div>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={addReadme}
                      onChange={(e) => setAddReadme(e.target.checked)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.configRow}>
                  <div>
                    <div className={styles.configTitle}>Add .gitignore</div>
                    <div className={styles.configDesc}>
                      .gitignore tells git which files not to track.
                    </div>
                  </div>
                  <select
                    value={gitignore}
                    onChange={(e) => setGitignore(e.target.value)}
                    className={styles.select}
                  >
                    <option value="None">No .gitignore</option>
                    <option value="Go">Go</option>
                    <option value="Node">Node</option>
                    <option value="Python">Python</option>
                    <option value="C++">C++</option>
                  </select>
                </div>

                <div className={styles.configRow}>
                  <div>
                    <div className={styles.configTitle}>Add license</div>
                    <div className={styles.configDesc}>
                      Licenses explain how others can use your code.
                    </div>
                  </div>
                  <select
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    className={styles.select}
                  >
                    <option value="None">No license</option>
                    <option value="MIT">MIT License</option>
                    <option value="GPL-3.0">GNU GPLv3</option>
                    <option value="Apache-2.0">Apache 2.0</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isLoading || !repoName.trim()}
            >
              {isLoading ? 'Creating...' : 'Create repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewRepository;