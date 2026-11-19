import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';

import { AppNavigation } from './AppNavigation';

function renderNavigation(pathname: string, collapsed: boolean) {
    return renderToStaticMarkup(
        <MemoryRouter>
            <AppNavigation pathname={pathname} collapsed={collapsed} desktop mobileOpen={false} onNavigate={() => {}} />
        </MemoryRouter>,
    );
}

describe('AppNavigation', () => {
    it('groups the existing destinations and marks the current route', () => {
        const html = renderNavigation('/payments', false);

        expect(html).toContain('Vue d’ensemble');
        expect(html).toContain('Gestion');
        expect(html).toContain('Configuration');
        for (const path of ['/', '/charges', '/payments', '/ledger', '/import', '/settings']) {
            expect(html).toContain(`href="${path}"`);
        }
        expect(html).toMatch(/href="\/payments"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/payments"/);
        expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    });

    it('keeps link labels accessible when the desktop sidebar is collapsed', () => {
        const html = renderNavigation('/', true);

        expect(html).toContain('title="Tableau de bord"');
        expect(html).toContain('<span class="md:sr-only">Tableau de bord</span>');
        expect(html).toContain('<span class="md:sr-only">Paiements</span>');
    });
});
