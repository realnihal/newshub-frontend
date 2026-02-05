// API Configuration
const API_CONFIG = {
    baseUrl: 'http://localhost:5001',
    endpoints: {
        news: '/api/v1/news',
        articles: '/articles',
        feeds: '/feeds',
        stats: '/api/v1/stats',
        categories: '/api/v1/categories',
        refresh: '/api/v1/refresh',
        health: '/api/v1/health',
        topics: '/topics',
        topicsTop: '/topics/top',
        topicsAnalyze: '/topics/analyze',
        topicsRefresh: '/topics/refresh'
    }
};

// Source Logo Configuration
// Uses Clearbit Logo API and fallbacks
const SOURCE_LOGOS = {
    // Major News Networks
    'Reuters': 'https://logo.clearbit.com/reuters.com',
    'AP News': 'https://logo.clearbit.com/apnews.com',
    'BBC': 'https://logo.clearbit.com/bbc.com',
    'BBC World': 'https://logo.clearbit.com/bbc.com',
    'CNN': 'https://logo.clearbit.com/cnn.com',
    'NPR': 'https://logo.clearbit.com/npr.org',
    'NPR News': 'https://logo.clearbit.com/npr.org',
    'PBS NewsHour': 'https://logo.clearbit.com/pbs.org',
    'ABC News': 'https://logo.clearbit.com/abcnews.go.com',
    'CBS News': 'https://logo.clearbit.com/cbsnews.com',
    'NBC News': 'https://logo.clearbit.com/nbcnews.com',
    'USA Today': 'https://logo.clearbit.com/usatoday.com',

    // International
    'The Guardian': 'https://logo.clearbit.com/theguardian.com',
    'The Guardian World': 'https://logo.clearbit.com/theguardian.com',
    'Al Jazeera': 'https://logo.clearbit.com/aljazeera.com',
    'France24': 'https://logo.clearbit.com/france24.com',
    'Deutsche Welle': 'https://logo.clearbit.com/dw.com',
    'Euronews': 'https://logo.clearbit.com/euronews.com',
    'Sky News': 'https://logo.clearbit.com/news.sky.com',
    'SCMP': 'https://logo.clearbit.com/scmp.com',
    'Japan Times': 'https://logo.clearbit.com/japantimes.co.jp',
    'ABC Australia': 'https://logo.clearbit.com/abc.net.au',
    'Times of India': 'https://logo.clearbit.com/timesofindia.indiatimes.com',
    'NHK World': 'https://logo.clearbit.com/nhk.or.jp',

    // Politics
    'The Hill': 'https://logo.clearbit.com/thehill.com',
    'Politico': 'https://logo.clearbit.com/politico.com',
    'Axios': 'https://logo.clearbit.com/axios.com',

    // Business
    'Reuters Business': 'https://logo.clearbit.com/reuters.com',
    'Bloomberg': 'https://logo.clearbit.com/bloomberg.com',
    'CNBC': 'https://logo.clearbit.com/cnbc.com',
    'MarketWatch': 'https://logo.clearbit.com/marketwatch.com',
    'Forbes': 'https://logo.clearbit.com/forbes.com',

    // Technology
    'TechCrunch': 'https://logo.clearbit.com/techcrunch.com',
    'Ars Technica': 'https://logo.clearbit.com/arstechnica.com',
    'The Verge': 'https://logo.clearbit.com/theverge.com',
    'Wired': 'https://logo.clearbit.com/wired.com',
    'Engadget': 'https://logo.clearbit.com/engadget.com',
    'Hacker News': 'https://logo.clearbit.com/news.ycombinator.com',

    // Science
    'Nature News': 'https://logo.clearbit.com/nature.com',
    'Phys.org': 'https://logo.clearbit.com/phys.org',
    'Scientific American': 'https://logo.clearbit.com/scientificamerican.com',
    'New Scientist': 'https://logo.clearbit.com/newscientist.com',

    // Sports
    'ESPN': 'https://logo.clearbit.com/espn.com'
};

// Default logo for unknown sources
const DEFAULT_LOGO = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A67C4E" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
</svg>
`);

// Get logo URL for a source
function getSourceLogo(sourceName) {
    if (!sourceName) return DEFAULT_LOGO;

    // Check exact match first
    if (SOURCE_LOGOS[sourceName]) {
        return SOURCE_LOGOS[sourceName];
    }

    // Check partial match
    for (const [key, url] of Object.entries(SOURCE_LOGOS)) {
        if (sourceName.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(sourceName.toLowerCase())) {
            return url;
        }
    }

    // Try to extract domain and use Clearbit
    const domainMatch = sourceName.match(/([a-zA-Z0-9-]+\.(com|org|net|co\.uk|io))/i);
    if (domainMatch) {
        return `https://logo.clearbit.com/${domainMatch[1]}`;
    }

    return DEFAULT_LOGO;
}

// Build full URL for an endpoint
function apiUrl(endpoint, params = {}) {
    const url = new URL(API_CONFIG.baseUrl + endpoint);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.append(key, value);
        }
    });
    return url.toString();
}
