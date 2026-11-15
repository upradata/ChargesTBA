import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';

import { Button } from './primitives';

describe('Button', () => {
    it('renders a link as the single slot target with its content and styles', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Button asChild variant="outline" className="custom-class">
                    <Link to="/charges">
                        <span>+</span> Nouvelle charge
                    </Link>
                </Button>
            </MemoryRouter>,
        );

        expect(html).toContain('href="/charges"');
        expect(html).toContain('custom-class');
        expect(html).toContain('<span>+</span> Nouvelle charge');
        expect(html).not.toContain('<button');
    });

    it('keeps the loading indicator inside the slot target', () => {
        const html = renderToStaticMarkup(
            <Button asChild loading>
                <a href="/charges">Charges</a>
            </Button>,
        );

        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('animate-spin');
        expect(html).toMatch(/<a\b[^>]*>.*animate-spin.*Charges<\/a>/);
    });

    it('preserves loading and disabled behavior for ordinary buttons', () => {
        const html = renderToStaticMarkup(<Button loading>Enregistrer</Button>);

        expect(html).toContain('<button');
        expect(html).toContain('disabled=""');
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('animate-spin');
        expect(html).toContain('Enregistrer');
    });
});
