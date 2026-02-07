// Initialize theme
(function() {
    const themeToggle = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    function getTheme() {
        const saved = localStorage.getItem('theme');
        if (saved) return saved;
        return prefersDark.matches ? 'dark' : 'light';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    setTheme(getTheme());

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            setTheme(current === 'dark' ? 'light' : 'dark');
        });
    }
})();

// News App
class NewsApp {
    constructor() {
        this.articles = [];
        this.topics = [];
        this.currentView = 'topics';
        this.currentCategory = 'all';
        this.currentSearch = '';
        this.offset = 0;
        this.limit = 20;
        this.hasMore = true;
        this.isLoading = false;
        this.currentTopic = null;
        this.chatMessages = [];

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadStats();
        await this.loadTopics();
    }

    bindEvents() {
        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentView = e.currentTarget.dataset.view;
                this.switchView();
            });
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.currentSearch = e.target.value;
                    if (this.currentView === 'articles') {
                        this.resetAndLoadArticles();
                    }
                }, 300);
            });
        }

        // Category filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCategory = e.target.dataset.category;
                this.resetAndLoadArticles();
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshAll());
        }

        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreArticles());
        }

        // Back button (for topic detail)
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view === 'topics') {
                this.showTopicsView();
            }
        });
    }

    switchView() {
        const topicsContainer = document.getElementById('topicsContainer');
        const articlesContainer = document.getElementById('articlesContainer');
        const topicDetailContainer = document.getElementById('topicDetailContainer');

        if (topicDetailContainer) {
            topicDetailContainer.style.display = 'none';
        }

        if (this.currentView === 'topics') {
            topicsContainer.style.display = 'block';
            articlesContainer.style.display = 'none';
            if (this.topics.length === 0) {
                this.loadTopics();
            }
        } else {
            topicsContainer.style.display = 'none';
            articlesContainer.style.display = 'block';
            if (this.articles.length === 0) {
                this.loadArticles();
            }
        }
    }

    async loadStats() {
        try {
            const response = await fetch(apiUrl(API_CONFIG.endpoints.stats));
            if (response.ok) {
                const data = await response.json();
                document.getElementById('totalArticles').textContent = data.articles.total;
                document.getElementById('totalFeeds').textContent = data.feeds.total;
            }

            // Load topic count
            const topicsResponse = await fetch(apiUrl('/topics'));
            if (topicsResponse.ok) {
                const topicsData = await topicsResponse.json();
                document.getElementById('totalTopics').textContent = topicsData.count;
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadTopics() {
        const grid = document.getElementById('topicsGrid');
        grid.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Analyzing news stories...</p>
            </div>
        `;

        try {
            // First, trigger topic analysis
            await fetch(apiUrl('/topics/analyze'), { method: 'POST' });

            // Then fetch topics
            const response = await fetch(apiUrl('/topics/top?limit=15'));
            if (response.ok) {
                const data = await response.json();
                this.topics = data.topics;
                this.renderTopics();
                document.getElementById('totalTopics').textContent = data.count;
            }
        } catch (error) {
            console.error('Failed to load topics:', error);
            grid.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>Unable to load stories</h3>
                    <p>Make sure the NewsAPI server is running at ${API_CONFIG.baseUrl}</p>
                </div>
            `;
        }
    }

    renderTopics() {
        const grid = document.getElementById('topicsGrid');

        if (this.topics.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                    </svg>
                    <h3>No stories yet</h3>
                    <p>Add more news feeds and click Refresh to generate story clusters</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.topics.map((topic, index) =>
            this.createTopicCard(topic, index === 0, index >= 3)
        ).join('');

        // Add click handlers for topic cards
        grid.querySelectorAll('.topic-card').forEach((card, index) => {
            card.addEventListener('click', () => this.showTopicDetail(this.topics[index]));
        });
    }

    createTopicCard(topic, featured = false, compact = false) {
        const hasImage = topic.thumbnail && topic.thumbnail.length > 0;
        const keywords = topic.keywords ? topic.keywords.slice(0, 4) : [];
        const sources = topic.sources ? topic.sources.slice(0, 3) : [];
        const timeAgo = this.formatTimeAgo(topic.updated_at);
        const isRecent = topic.updated_at &&
            (Date.now() - new Date(topic.updated_at).getTime()) < 7200000;

        const imageContent = hasImage
            ? `<img src="${this.escapeHtml(topic.thumbnail)}" alt="${this.escapeHtml(topic.title)}" onerror="this.parentElement.innerHTML='<div class=\\'placeholder-image\\'><svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1\\'><path d=\\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\\'></path><polyline points=\\'14 2 14 8 20 8\\'></polyline></svg></div>'">`
            : `<div class="placeholder-image">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            </div>`;

        // Create source logos HTML
        const sourceLogosHtml = sources.length > 0 ? `
            <div class="source-logos">
                ${sources.slice(0, 3).map(s => `
                    <img src="${getSourceLogo(s)}" alt="${this.escapeHtml(s)}" title="${this.escapeHtml(s)}"
                         onerror="this.src='${DEFAULT_LOGO}'" class="source-logo">
                `).join('')}
                ${sources.length > 3 ? `<span class="more-sources">+${sources.length - 3}</span>` : ''}
            </div>
        ` : '';

        return `
            <article class="topic-card ${featured ? 'featured' : ''} ${compact ? 'compact' : ''}" data-topic-id="${topic.id}">
                <div class="topic-card-header">
                    ${imageContent}
                    <div class="topic-card-badge ${isRecent ? 'recent' : ''}">
                        ${isRecent ? 'NEW' : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        ${topic.article_count} articles`}
                    </div>
                </div>
                <div class="topic-card-content">
                    <h3 class="topic-card-title">${this.escapeHtml(topic.title)}</h3>
                    <p class="topic-card-summary">${this.escapeHtml(topic.summary || '')}</p>
                    <div class="topic-card-keywords">
                        ${keywords.map(k => `<span class="keyword-tag">${this.escapeHtml(k)}</span>`).join('')}
                    </div>
                    <div class="topic-card-footer">
                        ${sourceLogosHtml || `<div class="topic-sources">${sources.map(s => `<span>${this.escapeHtml(s)}</span>`).join('')}</div>`}
                        <span class="topic-time">${timeAgo}</span>
                    </div>
                </div>
            </article>
        `;
    }

    async showTopicDetail(topic) {
        this.currentTopic = topic;

        // Hide other containers
        document.getElementById('topicsContainer').style.display = 'none';
        document.getElementById('articlesContainer').style.display = 'none';

        // Get or create topic detail container
        let detailContainer = document.getElementById('topicDetailContainer');
        if (!detailContainer) {
            detailContainer = document.createElement('div');
            detailContainer.id = 'topicDetailContainer';
            detailContainer.className = 'topic-detail';
            document.querySelector('.main-content').appendChild(detailContainer);
        }
        detailContainer.style.display = 'block';

        // Show loading state
        detailContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading story details...</p>
            </div>
        `;

        // Update browser history
        history.pushState({ view: 'topicDetail', topicId: topic.id }, '', `#topic/${topic.id}`);

        try {
            // Fetch topic details with articles
            const response = await fetch(apiUrl(`/topics/${topic.id}`));
            if (response.ok) {
                const data = await response.json();
                this.renderTopicDetail(data.topic);
            } else {
                this.renderTopicDetail(topic);
            }
        } catch (error) {
            console.error('Failed to load topic details:', error);
            this.renderTopicDetail(topic);
        }
    }

    renderTopicDetail(topic) {
        const container = document.getElementById('topicDetailContainer');
        const hasImage = topic.thumbnail && topic.thumbnail.length > 0;
        const keywords = topic.keywords ? topic.keywords.slice(0, 8) : [];
        const articles = topic.articles || [];
        const sources = topic.sources || [];

        const imageContent = hasImage
            ? `<img src="${this.escapeHtml(topic.thumbnail)}" alt="${this.escapeHtml(topic.title)}">`
            : `<div class="placeholder-image">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            </div>`;

        // Source logos for detail view
        const sourceLogosHtml = sources.length > 0 ? `
            <div class="source-logos" style="gap: 0.75rem;">
                ${sources.map(s => `
                    <img src="${getSourceLogo(s)}" alt="${this.escapeHtml(s)}" title="${this.escapeHtml(s)}"
                         onerror="this.src='${DEFAULT_LOGO}'" style="width: 28px; height: 28px;">
                `).join('')}
            </div>
        ` : '';

        container.innerHTML = `
            <div class="topic-detail-header">
                <nav class="topic-detail-breadcrumb">
                    <a href="#" onclick="app.showTopicsView(); return false;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        Back to Stories
                    </a>
                    <span>/</span>
                    <span>${topic.category || 'News'}</span>
                </nav>
            </div>

            <div class="topic-detail-hero">
                ${imageContent}
            </div>

            <h1 class="topic-detail-title">${this.escapeHtml(topic.title)}</h1>

            <div class="topic-detail-meta">
                ${sourceLogosHtml}
                <span>${topic.article_count || articles.length} articles</span>
                <span>${this.formatTimeAgo(topic.updated_at)}</span>
            </div>

            ${topic.summary ? `
                <div class="topic-detail-summary">
                    ${this.escapeHtml(topic.summary)}
                </div>
            ` : ''}

            <div class="topic-detail-keywords">
                ${keywords.map(k => `<span class="keyword-tag">${this.escapeHtml(k)}</span>`).join('')}
            </div>

            <div class="topic-detail-section">
                <h2>Coverage from ${articles.length} Sources</h2>
                <div class="topic-articles-list">
                    ${articles.map(article => this.createTopicArticleCard(article)).join('')}
                </div>
            </div>

            ${this.createImageGallery(articles)}

            <!-- Similar Articles Section -->
            <div class="similar-articles" id="similarArticles">
                <h3>Related Stories</h3>
                <div class="similar-articles-grid" id="similarArticlesGrid">
                    <div class="loading-spinner" style="grid-column: 1/-1; padding: 2rem;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>

            <!-- Chat Widget -->
            <div class="chat-widget">
                <button class="chat-toggle" onclick="app.toggleChat()" title="Ask AI about this topic">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
                <div class="chat-panel" id="chatPanel">
                    <div class="chat-header">
                        <span>Ask about this story</span>
                        <button class="chat-close" onclick="app.toggleChat()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="chat-messages" id="chatMessages">
                        <div class="chat-message bot">
                            Hi! I can answer questions about "${this.escapeHtml(topic.title)}". What would you like to know?
                        </div>
                    </div>
                    <div class="chat-input-container">
                        <input type="text" class="chat-input" id="chatInput" placeholder="Type your question..."
                               onkeypress="if(event.key==='Enter') app.sendChatMessage()">
                        <button class="chat-send" onclick="app.sendChatMessage()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Reset chat messages for new topic
        this.chatMessages = [];

        // Load similar articles asynchronously
        this.loadSimilarArticles(topic.id);
    }

    async loadSimilarArticles(topicId) {
        const grid = document.getElementById('similarArticlesGrid');
        if (!grid) return;

        try {
            const response = await fetch(apiUrl(`/topics/${topicId}/similar?limit=5`));
            if (response.ok) {
                const data = await response.json();
                if (data.similar && data.similar.length > 0) {
                    grid.innerHTML = data.similar.map(article => `
                        <a href="${this.escapeHtml(article.link)}" target="_blank" class="similar-article-card">
                            <div class="similar-article-image">
                                ${article.thumbnail
                                    ? `<img src="${this.escapeHtml(article.thumbnail)}" alt="" loading="lazy">`
                                    : ''
                                }
                            </div>
                            <div class="similar-article-content">
                                <h4 class="similar-article-title">${this.escapeHtml(article.title)}</h4>
                                <div class="similar-article-meta">
                                    <img src="${getSourceLogo(article.source)}" alt="" class="source-logo" style="width:16px;height:16px;">
                                    ${this.escapeHtml(article.source)} · ${this.formatTimeAgo(article.published_at)}
                                </div>
                            </div>
                        </a>
                    `).join('');
                } else {
                    document.getElementById('similarArticles').style.display = 'none';
                }
            } else {
                document.getElementById('similarArticles').style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load similar articles:', error);
            document.getElementById('similarArticles').style.display = 'none';
        }
    }

    createTopicArticleCard(article) {
        const hasThumbnail = article.thumbnail && article.thumbnail.length > 0;
        const timeAgo = this.formatTimeAgo(article.published_at);
        const sourceName = article.feed_name || article.source || 'Unknown';

        return `
            <a href="${this.escapeHtml(article.link)}" target="_blank" class="topic-article-card">
                <div class="topic-article-image">
                    ${hasThumbnail
                        ? `<img src="${this.escapeHtml(article.thumbnail)}" alt="" onerror="this.style.display='none'">`
                        : `<div style="width:100%;height:100%;background:var(--gradient);"></div>`
                    }
                </div>
                <div class="topic-article-content">
                    <h4 class="topic-article-title">${this.escapeHtml(article.title)}</h4>
                    <div class="topic-article-meta">
                        <img src="${getSourceLogo(sourceName)}" alt="" class="source-logo" onerror="this.src='${DEFAULT_LOGO}'">
                        <span>${this.escapeHtml(sourceName)}</span>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            </a>
        `;
    }

    createImageGallery(articles) {
        const images = articles
            .filter(a => a.thumbnail && a.thumbnail.length > 0)
            .map(a => a.thumbnail)
            .slice(0, 8);

        if (images.length < 3) return '';

        return `
            <div class="image-gallery">
                <h3>Images from Coverage</h3>
                <div class="gallery-grid">
                    ${images.map(img => `
                        <div class="gallery-item" onclick="app.openLightbox('${this.escapeHtml(img)}')">
                            <img src="${this.escapeHtml(img)}" alt="" loading="lazy">
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="lightbox" id="lightbox" onclick="app.closeLightbox()">
                <span class="lightbox-close">&times;</span>
                <img src="" alt="" id="lightboxImage">
            </div>
        `;
    }

    openLightbox(imageSrc) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImage = document.getElementById('lightboxImage');
        if (lightbox && lightboxImage) {
            lightboxImage.src = imageSrc;
            lightbox.classList.add('open');
        }
    }

    closeLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (lightbox) {
            lightbox.classList.remove('open');
        }
    }

    showTopicsView() {
        this.currentTopic = null;

        const topicDetailContainer = document.getElementById('topicDetailContainer');
        if (topicDetailContainer) {
            topicDetailContainer.style.display = 'none';
        }

        document.getElementById('topicsContainer').style.display = 'block';
        document.getElementById('articlesContainer').style.display = 'none';

        // Update browser history
        history.pushState({ view: 'topics' }, '', '#');
    }

    toggleChat() {
        const chatPanel = document.getElementById('chatPanel');
        if (chatPanel) {
            chatPanel.classList.toggle('open');
            if (chatPanel.classList.contains('open')) {
                document.getElementById('chatInput').focus();
            }
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('chatInput');
        const messagesContainer = document.getElementById('chatMessages');
        const question = input.value.trim();

        if (!question || !this.currentTopic) return;

        // Add user message
        messagesContainer.innerHTML += `
            <div class="chat-message user">${this.escapeHtml(question)}</div>
        `;

        // Clear input
        input.value = '';

        // Show typing indicator
        messagesContainer.innerHTML += `
            <div class="chat-typing" id="typingIndicator">
                <span></span><span></span><span></span>
            </div>
        `;

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await fetch(apiUrl(`/topics/${this.currentTopic.id}/ask`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            // Remove typing indicator
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) typingIndicator.remove();

            if (response.ok) {
                const data = await response.json();
                messagesContainer.innerHTML += `
                    <div class="chat-message bot">${this.escapeHtml(data.answer)}</div>
                `;
            } else {
                messagesContainer.innerHTML += `
                    <div class="chat-message bot">Sorry, I couldn't process that question. Please try again.</div>
                `;
            }
        } catch (error) {
            // Remove typing indicator
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) typingIndicator.remove();

            messagesContainer.innerHTML += `
                <div class="chat-message bot">Sorry, I'm having trouble connecting. The AI Q&A feature requires the backend to be configured with an LLM provider.</div>
            `;
        }

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async loadArticles() {
        if (this.isLoading) return;
        this.isLoading = true;

        const grid = document.getElementById('newsGrid');
        const loadMoreBtn = document.getElementById('loadMoreBtn');

        if (this.offset === 0) {
            grid.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading articles...</p>
                </div>
            `;
        }

        try {
            const params = {
                limit: this.limit,
                offset: this.offset
            };

            if (this.currentSearch) {
                const response = await fetch(apiUrl(API_CONFIG.endpoints.articles, {
                    search: this.currentSearch,
                    page: Math.floor(this.offset / this.limit) + 1,
                    per_page: this.limit
                }));

                if (response.ok) {
                    const data = await response.json();
                    this.articles = this.offset === 0 ? data.articles : [...this.articles, ...data.articles];
                    this.hasMore = data.pagination.has_next;
                }
            } else {
                if (this.currentCategory && this.currentCategory !== 'all') {
                    params.category = this.currentCategory;
                }

                const response = await fetch(apiUrl(API_CONFIG.endpoints.news, params));
                if (response.ok) {
                    const data = await response.json();
                    this.articles = this.offset === 0 ? data.news : [...this.articles, ...data.news];
                    this.hasMore = data.meta.has_more;
                }
            }

            this.renderArticles();

            if (loadMoreBtn) {
                loadMoreBtn.style.display = this.hasMore ? 'block' : 'none';
            }

        } catch (error) {
            console.error('Failed to load articles:', error);
            grid.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>Unable to load news</h3>
                    <p>Make sure the NewsAPI server is running at ${API_CONFIG.baseUrl}</p>
                </div>
            `;
        } finally {
            this.isLoading = false;
        }
    }

    renderArticles() {
        const grid = document.getElementById('newsGrid');

        if (this.articles.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <h3>No articles found</h3>
                    <p>Try adjusting your search or add more RSS feeds</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.articles.map(article => this.createArticleCard(article)).join('');
    }

    createArticleCard(article) {
        const timeAgo = this.formatTimeAgo(article.published_at);
        const description = this.stripHtml(article.description || '').substring(0, 150);
        const hasThumbnail = article.thumbnail && article.thumbnail.length > 0;
        const sourceName = article.feed_name || 'Unknown';

        const imageContent = hasThumbnail
            ? `<img src="${this.escapeHtml(article.thumbnail)}" alt="${this.escapeHtml(article.title)}" onerror="this.parentElement.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1\\'><path d=\\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\\'></path><polyline points=\\'14 2 14 8 20 8\\'></polyline><line x1=\\'16\\' y1=\\'13\\' x2=\\'8\\' y2=\\'13\\'></line><line x1=\\'16\\' y1=\\'17\\' x2=\\'8\\' y2=\\'17\\'></line></svg>'">`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>`;

        return `
            <article class="news-card">
                <div class="news-card-image">
                    ${imageContent}
                </div>
                <div class="news-card-content">
                    <div class="news-card-meta">
                        <img src="${getSourceLogo(sourceName)}" alt="" class="source-logo" onerror="this.src='${DEFAULT_LOGO}'">
                        <span class="news-card-source">${this.escapeHtml(sourceName)}</span>
                        <span class="news-card-time">${timeAgo}</span>
                    </div>
                    <h3 class="news-card-title">${this.escapeHtml(article.title)}</h3>
                    <p class="news-card-description">${this.escapeHtml(description)}${description.length >= 150 ? '...' : ''}</p>
                    <div class="news-card-footer">
                        <a href="${this.escapeHtml(article.link)}" target="_blank" class="read-more">
                            Read more
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </a>
                        <div class="news-card-actions">
                            <button class="action-btn ${article.is_starred ? 'starred' : ''}" onclick="app.toggleStar(${article.id})" title="Star article">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${article.is_starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    async toggleStar(articleId) {
        try {
            const article = this.articles.find(a => a.id === articleId);
            const endpoint = article.is_starred ? 'unstar' : 'star';
            const response = await fetch(apiUrl(`${API_CONFIG.endpoints.articles}/${articleId}/${endpoint}`), {
                method: 'POST'
            });
            if (response.ok) {
                article.is_starred = !article.is_starred;
                this.renderArticles();
            }
        } catch (error) {
            console.error('Failed to toggle star:', error);
        }
    }

    async refreshAll() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.classList.add('loading');

        try {
            // Refresh feeds
            await fetch(apiUrl(API_CONFIG.endpoints.refresh), { method: 'POST' });

            // Refresh topics
            await fetch(apiUrl('/topics/refresh'), { method: 'POST' });

            // Reload data
            await this.loadStats();

            if (this.currentView === 'topics') {
                await this.loadTopics();
            } else {
                this.resetAndLoadArticles();
            }
        } catch (error) {
            console.error('Failed to refresh:', error);
        } finally {
            refreshBtn.classList.remove('loading');
        }
    }

    resetAndLoadArticles() {
        this.articles = [];
        this.offset = 0;
        this.hasMore = true;
        this.loadArticles();
    }

    loadMoreArticles() {
        this.offset += this.limit;
        this.loadArticles();
    }

    formatTimeAgo(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

        return date.toLocaleDateString();
    }

    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const app = new NewsApp();
