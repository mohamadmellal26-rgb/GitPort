import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../Header';
import styles from './RepositoryView.module.css';

// تحديد عنوان الـ API تلقائياً حسب بيئة التشغيل
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8080' 
  : 'https://gitport.onrender.com';

interface RepositoryData {
  id: number;
  owner: string;
  name: string;
  description: string;
  is_private: boolean;
}

export const RepositoryView: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const [repoData, setRepoData] = useState<RepositoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'issues' | 'pulls' | 'settings'>('code');
  
  const [files, setFiles] = useState<string[]>([]);
  const [hasCommits, setHasCommits] = useState(false);

  // حالات فتح وقراءة وتعديل الملف
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  
  // حالات وضع التعديل وإنشاء ملف جديد
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newFilePath, setNewFilePath] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDeletingRepo, setIsDeletingRepo] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        if (decodedPayload.username) {
          setCurrentUser(decodedPayload.username);
        }
      } catch (err) {
        console.error('Error parsing token payload:', err);
      }
    }
  }, []);

  const fetchRepoDataAndFiles = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/v1/repositories/${owner}/${repo}`, { headers });
      if (!response.ok) {
        setNotFound(true);
        return;
      }
      const data = await response.json();
      setRepoData(data);

      const filesRes = await fetch(`${API_BASE_URL}/api/v1/repositories/${owner}/${repo}/files`, { headers });
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setHasCommits(filesData.has_commits);
        setFiles(filesData.files || []);
      }
    } catch (err) {
      console.error('Error fetching repository:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    if (owner && repo) {
      fetchRepoDataAndFiles();
    }
  }, [owner, repo, fetchRepoDataAndFiles]);

  // فتح الملف وقراءته
  const handleOpenFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setIsEditing(false);
    setIsCreatingNew(false);
    setLoadingFile(true);
    setFileContent('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/repositories/${owner}/${repo}/file-content?path=${encodeURIComponent(filePath)}&t=${Date.now()}`
      );
      if (response.ok) {
        const data = await response.json();
        setFileContent(data.content);
      } else {
        setFileContent('فشل فتح الملف أو لا يوجد محتوى.');
      }
    } catch (err) {
      console.error('Error fetching file content:', err);
      setFileContent('خطأ أثناء جلب محتوى الملف.');
    } finally {
      setLoadingFile(false);
    }
  };

  // حفظ الملف (إنشاء أو تعديل)
  const handleSaveFile = async () => {
    const targetPath = isCreatingNew ? newFilePath.trim() : selectedFile;
    if (!targetPath) {
      alert('الرجاء تحديد مسار صحيح للملف');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/repositories/${owner}/${repo}/save-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: targetPath,
          content: fileContent,
          message: commitMessage || (isCreatingNew ? `Create ${targetPath}` : `Update ${targetPath}`)
        })
      });

      if (response.ok) {
        alert('تم حفظ الملف بنجاح!');
        setIsEditing(false);
        setIsCreatingNew(false);
        setCommitMessage('');
        
        await fetchRepoDataAndFiles();
        await handleOpenFile(targetPath);
      } else {
        const errData = await response.json();
        alert(errData.error || 'فشل حفظ الملف');
      }
    } catch (err) {
      console.error('Error saving file:', err);
      alert('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSaving(false);
    }
  };

  // حذف ملف معين
  const handleDeleteFile = async (filePathToDelete?: string) => {
    const targetPath = filePathToDelete || selectedFile;
    if (!targetPath) return;

    if (!window.confirm(`هل أنت تأكد من رغبتك في حذف الملف "${targetPath}"؟`)) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/repositories/${owner}/${repo}/delete-file`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          path: targetPath,
          message: `Delete ${targetPath}`
        })
      });

      if (response.ok) {
        alert('تم حذف الملف بنجاح!');
        setSelectedFile(null);
        setIsEditing(false);
        await fetchRepoDataAndFiles();
      } else {
        const errData = await response.json();
        alert(errData.error || 'فشل حذف الملف');
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('حدث خطأ أثناء طلب الحذف');
    } finally {
      setIsDeleting(false);
    }
  };

  // حذف المستودع بالكامل
  const handleDeleteRepository = async () => {
    if (!repoData) return;

    const confirmText = prompt(`حذف المستودع إجراء نهائي ولا يمكن التراجع عنه.\nللتأكيد، يرجى كتابة اسم المستودع: ${repoData.name}`);
    
    if (confirmText !== repoData.name) {
      alert('اسم المستودع غير مطابق. تم إلغاء عملية الحذف.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setIsDeletingRepo(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/repositories/${owner}/${repo}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('تم حذف المستودع بنجاح!');
        navigate('/'); // إعادة التوجيه إلى الصفحة الرئيسية
      } else {
        const errData = await response.json();
        alert(errData.error || 'فشل حذف المستودع');
      }
    } catch (err) {
      console.error('Error deleting repository:', err);
      alert('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsDeletingRepo(false);
    }
  };

  const isOwner = currentUser && repoData && currentUser.toLowerCase() === repoData.owner.toLowerCase();

  if (loading) {
    return <div style={{ padding: 40, color: '#1f2328' }}>Loading repository...</div>;
  }

  if (notFound || !repoData) {
    return (
      <div className={styles.pageWrapper}>
        <Header />
        <div style={{ padding: 40, textAlign: 'center', color: '#1f2328' }}>
          <h2>404 - Repository Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <Header username={currentUser || 'User'} />

      <div className={styles.subHeader}>
        <div className={styles.subHeaderContent}>
          <div className={styles.repoBreadcrumb}>
            <span className={styles.ownerText}>{repoData.owner}</span>
            <span className={styles.divider}>/</span>
            <span className={styles.repoText}>{repoData.name}</span>
            <span className={styles.badge}>{repoData.is_private ? 'Private' : 'Public'}</span>
          </div>

          <nav className={styles.tabsNav}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'code' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('code'); setSelectedFile(null); setIsEditing(false); setIsCreatingNew(false); }}
            >
              Code
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'issues' ? styles.activeTab : ''}`} onClick={() => setActiveTab('issues')}>Issues</button>
            <button className={`${styles.tabBtn} ${activeTab === 'pulls' ? styles.activeTab : ''}`} onClick={() => setActiveTab('pulls')}>Pull requests</button>
            {isOwner && (
              <button className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.activeTab : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
            )}
          </nav>
        </div>
      </div>

      <main className={styles.mainContainer}>
        {activeTab === 'code' ? (
          <>
            <div className={styles.repoActionsHeader}>
              <div className={styles.repoTitleRow}>
                <h1 className={styles.repoTitle}>{repoData.name}</h1>
              </div>
              <div className={styles.actionButtons}>
                {isOwner && (
                  <button 
                    onClick={() => { setIsCreatingNew(true); setSelectedFile(null); setFileContent(''); setNewFilePath(''); }}
                    style={{ background: '#238636', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    + Add file
                  </button>
                )}
              </div>
            </div>

            {/* شاشة إنشاء ملف جديد */}
            {isCreatingNew ? (
              <div style={{ marginTop: '20px', border: '1px solid #d0d7de', borderRadius: '6px', background: '#fff', padding: '20px' }}>
                <h3>Create new file</h3>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>File name:</label>
                  <input
                    type="text"
                    placeholder="e.g. src/index.js or README.md"
                    value={newFilePath}
                    onChange={(e) => setNewFilePath(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d0d7de', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Content:</label>
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    rows={15}
                    style={{ width: '100%', fontFamily: 'monospace', padding: '10px', border: '1px solid #d0d7de', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Commit message:</label>
                  <input
                    type="text"
                    placeholder="Add new file"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d0d7de', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    disabled={isSaving}
                    onClick={handleSaveFile}
                    style={{ background: '#238636', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {isSaving ? 'Committing...' : 'Commit new file'}
                  </button>
                  <button
                    onClick={() => setIsCreatingNew(false)}
                    style={{ background: '#f6f8fa', border: '1px solid #d0d7de', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selectedFile ? (
              /* شاشة عرض أو تعديل أو حذف ملف موجود */
              <div style={{ marginTop: '20px', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ background: '#f6f8fa', padding: '12px 16px', borderBottom: '1px solid #d0d7de', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>📄 {selectedFile}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isOwner && !isEditing && (
                      <>
                        <button 
                          onClick={() => setIsEditing(true)}
                          style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: '6px', border: '1px solid #d0d7de', background: '#238636', color: '#fff', fontWeight: 'bold' }}
                        >
                          Edit
                        </button>
                        <button 
                          disabled={isDeleting}
                          onClick={() => handleDeleteFile()}
                          style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: '6px', border: '1px solid #d0d7de', background: '#cf222e', color: '#fff', fontWeight: 'bold' }}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => { setSelectedFile(null); setIsEditing(false); }}
                      style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: '6px', border: '1px solid #d0d7de', background: '#fff' }}
                    >
                      ← Back to files
                    </button>
                  </div>
                </div>

                <div style={{ padding: '16px', background: '#ffffff', overflowX: 'auto' }}>
                  {loadingFile ? (
                    <div>Loading file content...</div>
                  ) : isEditing ? (
                    <div>
                      <textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        rows={20}
                        style={{ width: '100%', fontFamily: 'monospace', padding: '10px', border: '1px solid #d0d7de', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Commit changes message:</label>
                        <input
                          type="text"
                          placeholder={`Update ${selectedFile}`}
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d0d7de', borderRadius: '6px', marginBottom: '15px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          disabled={isSaving}
                          onClick={handleSaveFile}
                          style={{ background: '#238636', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          {isSaving ? 'Saving changes...' : 'Commit changes'}
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          style={{ background: '#f6f8fa', border: '1px solid #d0d7de', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {fileContent}
                    </pre>
                  )}
                </div>
              </div>
            ) : hasCommits ? (
              /* قائمة الملفات مع خيار الحذف المباشر */
              <div style={{ marginTop: '20px', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ background: '#f6f8fa', padding: '12px 16px', borderBottom: '1px solid #d0d7de', fontWeight: 'bold' }}>
                  Files ({files.length})
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {files.map((file, index) => (
                    <li key={index} style={{ padding: '10px 16px', borderBottom: index < files.length - 1 ? '1px solid #d0d7de' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📄</span>
                        <span 
                          onClick={() => handleOpenFile(file)}
                          style={{ fontFamily: 'monospace', color: '#0969da', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {file}
                        </span>
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteFile(file)}
                          style={{ background: 'transparent', border: 'none', color: '#cf222e', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className={styles.setupBox}>
                <div className={styles.setupHeader}>
                  <h2>Quick setup — Get started by adding files</h2>
                </div>
                {isOwner && (
                  <div style={{ marginTop: '15px' }}>
                    <button 
                      onClick={() => { setIsCreatingNew(true); setFileContent(''); setNewFilePath('README.md'); }}
                      style={{ background: '#238636', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Create a new README.md file
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : activeTab === 'settings' ? (
          /* واجهة الإعدادات مع خيار حذف المستودع الكامل */
          <div style={{ marginTop: '20px', border: '1px solid #d0d7de', borderRadius: '6px', background: '#ffffff', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px', borderBottom: '1px solid #d0d7de', paddingBottom: '10px' }}>Repository Settings</h2>
            
            {isOwner ? (
              <div style={{ marginTop: '30px' }}>
                <h3 style={{ fontSize: '16px', color: '#cf222e', marginBottom: '8px' }}>Danger Zone</h3>
                <div style={{ border: '1px solid #cf222e', borderRadius: '6px', padding: '16px', background: '#fff8f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#24292f' }}>Delete this repository</strong>
                    <span style={{ fontSize: '13px', color: '#57606a' }}>
                      Once you delete a repository, there is no going back. Please be certain.
                    </span>
                  </div>
                  <button
                    disabled={isDeletingRepo}
                    onClick={handleDeleteRepository}
                    style={{
                      background: '#cf222e',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {isDeletingRepo ? 'Deleting...' : 'Delete this repository'}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ color: '#57606a' }}>You do not have administrative permissions to view or change settings for this repository.</p>
            )}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#57606a' }}>
            <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} feature is coming soon!</h3>
          </div>
        )}
      </main>
    </div>
  );
};

export default RepositoryView;