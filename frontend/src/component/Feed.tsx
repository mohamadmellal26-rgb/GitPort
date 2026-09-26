import React, { useState } from 'react';
import styles from './Feed.module.css';

export interface RepositoryItem {
  id: string;
  name: string;
  description: string;
  language: string;
  languageColor: string;
  stars: string;
}

const TRENDING_REPOS: RepositoryItem[] = [
  {
    id: '1',
    name: 'driceroland/Search',
    description: 'A small, fast WebKit browser for macOS, by Office Commun.',
    language: 'Swift',
    languageColor: '#F05138',
    stars: '2k',
  },
  {
    id: '2',
    name: 'paperclipai/paperclip',
    description: 'The open-source app everyone uses to manage agents at work',
    language: 'TypeScript',
    languageColor: '#3178C6',
    stars: '85.7k',
  },
];

export const Feed: React.FC = () => {
  const [prompt, setPrompt] = useState('');

  return (
    <div className={styles.feedContainer}>
      {/* Copilot Prompt Input Area */}
      <div className={styles.copilotBox}>
        <textarea
          className={styles.copilotTextarea}
          placeholder="Ask anything or type @ to add context"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
        />
        
        <div className={styles.copilotToolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.selectGroup}>
              <button className={styles.iconDropdownBtn} type="button">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 13H1.75A1.75 1.75 0 0 1 0 11.25v-8.5C0 1.784.784 1 1.75 1ZM1.5 2.75v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z"></path>
                </svg>
                Ask
                <span className={styles.arrowDown}>▾</span>
              </button>
            </div>

            <div className={styles.selectGroup}>
              <button className={styles.iconDropdownBtn} type="button">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-11h-8a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1.75a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 13.5v-11Z"></path>
                </svg>
                All repositories
                <span className={styles.arrowDown}>▾</span>
              </button>
            </div>

            <button className={styles.iconSquareBtn} type="button" title="Add attachment">
              +
            </button>
          </div>

          <div className={styles.toolbarRight}>
            <button className={styles.textSelectBtn} type="button">
              Auto <span className={styles.arrowDown}>▾</span>
            </button>
            <button className={styles.textSelectBtn} type="button">
              Optimized for: Balance <span className={styles.arrowDown}>▾</span>
            </button>
            <button className={styles.iconOnlyBtn} type="button" title="History">
              ⏱
            </button>
            <button className={styles.sendBtn} type="button" title="Send">
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* Action Chips */}
      <div className={styles.actionChips}>
        <button className={styles.chipBtn} type="button">🐞 Debug</button>
        <button className={styles.chipBtn} type="button">☁️ Agent</button>
        <button className={styles.chipBtn} type="button">◌ Create issue</button>
        <button className={styles.chipBtn} type="button">📄 Write code ▾</button>
        <button className={styles.chipBtn} type="button">⌥ Git ▾</button>
        <button className={styles.chipBtn} type="button">⑂ Pull requests ▾</button>
      </div>

      {/* Feed Header */}
      <div className={styles.feedHeader}>
        <h3 className={styles.feedTitle}>Feed</h3>
        <button className={styles.filterBtn} type="button">
          ⚙ Filter
        </button>
      </div>

      {/* Trending Repositories Card Group */}
      <div className={styles.feedCard}>
        <div className={styles.cardHeader}>
          <span>📈 Trending repositories · <a href="#see-more" className={styles.seeMoreLink}>See more</a></span>
        </div>

        <div className={styles.repoList}>
          {TRENDING_REPOS.map((repo, index) => (
            <div key={repo.id} className={`${styles.repoItem} ${index < TRENDING_REPOS.length - 1 ? styles.borderBottom : ''}`}>
              <div className={styles.repoMain}>
                <div className={styles.repoNameRow}>
                  <span className={styles.repoIcon}>
                    {index === 0 ? '⎈' : '📎'}
                  </span>
                  <a href={`/${repo.name}`} className={styles.repoName}>
                    {repo.name}
                  </a>
                </div>
                <p className={styles.repoDescription}>{repo.description}</p>
                <div className={styles.repoMeta}>
                  <span className={styles.langMeta}>
                    <span className={styles.langColor} style={{ backgroundColor: repo.languageColor }} />
                    {repo.language}
                  </span>
                  <span className={styles.starMeta}>
                    ☆ {repo.stars}
                  </span>
                </div>
              </div>

              <div className={styles.repoActions}>
                <div className={styles.starBtnGroup}>
                  <button className={styles.starBtn} type="button">☆ Star</button>
                  <button className={styles.starDropdownBtn} type="button">▾</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Feed;