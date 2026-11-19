import { Building2, CreditCard, Home, List, Receipt, Settings, Upload } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

export const navigationGroups = [
    {
        label: 'Vue d’ensemble',
        items: [{ path: '/', label: 'Tableau de bord', icon: Home }],
    },
    {
        label: 'Gestion',
        items: [
            { path: '/charges', label: 'Charges', icon: Receipt },
            { path: '/payments', label: 'Paiements', icon: CreditCard },
            { path: '/ledger', label: 'Mouvements', icon: List },
        ],
    },
    {
        label: 'Configuration',
        items: [
            { path: '/import', label: 'Importer', icon: Upload },
            { path: '/settings', label: 'Paramètres', icon: Settings },
        ],
    },
];

export function AppNavigation({
    pathname,
    mobileOpen,
    desktop,
    collapsed,
    onNavigate,
}: {
    pathname: string;
    mobileOpen: boolean;
    desktop: boolean;
    collapsed: boolean;
    onNavigate: () => void;
}) {
    const sidebar = useRef<HTMLElement>(null);
    useEffect(() => {
        if (mobileOpen && !desktop) {
            const nav = sidebar.current;
            (nav?.querySelector<HTMLElement>('[aria-current="page"]') ?? nav?.querySelector('a'))?.focus({
                preventScroll: true,
            });
        }
    }, [mobileOpen, desktop]);

    return (
        <aside
            id="primary-navigation"
            ref={sidebar}
            inert={!desktop && !mobileOpen}
            className={`bg-card fixed start-0 top-16 z-40 flex h-[calc(100dvh-4rem)] w-72 max-w-full flex-col overflow-x-hidden overflow-y-auto p-3 motion-safe:transition-transform motion-safe:duration-200 md:sticky md:top-2 md:col-start-1 md:row-start-1 md:h-[calc(100dvh-1rem)] md:w-auto md:translate-x-0 md:self-start md:bg-transparent md:shadow-none md:transition-none ${mobileOpen ? 'translate-x-0 shadow-xl' : 'pointer-events-none -translate-x-full md:pointer-events-auto rtl:translate-x-full md:rtl:translate-x-0'}`}>
            <div className={`mb-7 flex items-center gap-3 px-2 py-2 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
                <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg">
                    <Building2 className="size-5" aria-hidden="true" />
                </span>
                <div className={collapsed ? 'md:sr-only' : undefined}>
                    <p className="text-sm font-semibold tracking-tight">ChargesTBA</p>
                    <p className="text-muted-foreground text-xs">Gestion de copropriété</p>
                </div>
            </div>
            <nav aria-label="Navigation principale" className="grid gap-5">
                {navigationGroups.map(group => (
                    <div key={group.label}>
                        <p
                            className={`text-muted-foreground mb-2 px-3 text-xs font-medium ${collapsed ? 'md:sr-only' : ''}`}>
                            {group.label}
                        </p>
                        <div className="grid gap-1">
                            {group.items.map(({ path, label, icon: Icon }) => {
                                const active = pathname === path;
                                return (
                                    <Link
                                        key={path}
                                        to={path}
                                        onClick={onNavigate}
                                        aria-current={active ? 'page' : undefined}
                                        title={collapsed ? label : undefined}
                                        className={`focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${collapsed ? 'md:justify-center md:px-0' : ''} ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                                        <span className={collapsed ? 'md:sr-only' : undefined}>{label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
            <div className={`mt-auto border-t px-2 pt-4 ${collapsed ? 'md:sr-only' : ''}`}>
                <p className="text-xs font-medium">Prototype local</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                    Vos données sont conservées dans cette installation.
                </p>
            </div>
        </aside>
    );
}
