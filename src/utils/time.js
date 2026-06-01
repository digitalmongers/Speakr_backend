/**
 * Calculate the human-readable relative time string (e.g. "2 hours ago", "5 days ago", "1 month ago")
 * @param {Date|string} dateStringOrDate - The date to compare against current time
 * @returns {string} Relative time string
 */
const getRelativeTimeAgo = (dateStringOrDate) => {
    const date = new Date(dateStringOrDate);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    // Fallback for slight client-server clock skew
    if (seconds < 0) {
        return 'just now';
    }

    const intervals = {
        year: 31536000,
        month: 2592000,
        day: 86400,
        hour: 3600,
        minute: 60,
    };

    for (const [key, value] of Object.entries(intervals)) {
        const count = Math.floor(seconds / value);
        if (count >= 1) {
            return `${count} ${key}${count > 1 ? 's' : ''} ago`;
        }
    }

    return 'just now';
};

module.exports = {
    getRelativeTimeAgo,
};
