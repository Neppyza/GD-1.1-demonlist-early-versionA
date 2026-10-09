(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let preference;
    try { preference = localStorage.getItem('crux-theme') || localStorage.getItem('demonlist-theme'); } catch {}
    if (!['light', 'dark'].includes(preference)) preference = undefined;
    const apply = theme => { document.documentElement.dataset.theme = theme; };
    apply(['light', 'dark'].includes(preference) ? preference : media.matches ? 'dark' : 'light');
    document.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('.header-inner');
        if (!header) return;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'theme-toggle';
        const render = () => {
            const dark = document.documentElement.dataset.theme === 'dark';
            button.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
            button.title = button.getAttribute('aria-label');
            button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">${dark ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>' : '<path d="M20.5 13a8.5 8.5 0 1 1-9.5-9.5 7 7 0 0 0 9.5 9.5Z"/>'}</svg>`;
        };
        button.addEventListener('click', () => {
            preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            apply(preference);
            try { localStorage.setItem('crux-theme', preference); } catch {}
            render();
        });
        media.addEventListener('change', () => { if (!preference) { apply(media.matches ? 'dark' : 'light'); render(); } });
        render(); header.append(button);
    });
})();
