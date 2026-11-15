import type { ReactNode } from 'react';

type PageHeadingProps = {
    eyebrow: string;
    title: string;
    description: string;
    actions?: ReactNode;
};

export function PageHeading({ eyebrow, title, description, actions }: PageHeadingProps) {
    return (
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
                <p className="text-primary text-xs font-semibold tracking-wider uppercase">{eyebrow}</p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                <p className="text-muted-foreground max-w-2xl text-sm leading-6">{description}</p>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
