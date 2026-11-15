import { Slottable } from '@radix-ui/react-slot';
import {
    useEffect,
    useId,
    useRef,
    type ChangeEvent,
    type ComponentProps,
    type CSSProperties,
    type ReactNode,
} from 'react';

import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from './alert';
import { Badge as ShadcnBadge } from './badge';
import { Button as ShadcnButton } from './button';
import { Card as ShadcnCard } from './card';
import { Input } from './input';
import { Label } from './label';
import { Progress as ShadcnProgress } from './progress';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

const gaps: Record<string, string> = {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
};

function gapClass(gap: string | number | undefined, fallback: string) {
    if (typeof gap === 'number') return `gap-[${gap}px]`;
    return gaps[gap ?? ''] ?? fallback;
}

export function Stack({ gap = 'md', className, ...props }: ComponentProps<'div'> & { gap?: string | number }) {
    return <div className={`flex flex-col ${gapClass(gap, 'gap-4')} ${className ?? ''}`} {...props} />;
}

const justifications: Record<string, string> = {
    'start': 'justify-start',
    'center': 'justify-center',
    'end': 'justify-end',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
    'space-evenly': 'justify-evenly',
};

const alignments: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    baseline: 'items-baseline',
    stretch: 'items-stretch',
};

export function Group({
    gap = 'md',
    align = 'center',
    justify,
    wrap = 'wrap',
    className,
    ...props
}: ComponentProps<'div'> & {
    gap?: string | number;
    align?: string;
    justify?: string;
    wrap?: 'wrap' | 'nowrap';
}) {
    return (
        <div
            className={`flex ${gapClass(gap, 'gap-4')} ${alignments[align] ?? 'items-center'} ${justifications[justify ?? ''] ?? ''} ${wrap === 'nowrap' ? 'flex-nowrap' : 'flex-wrap'} ${className ?? ''}`}
            {...props}
        />
    );
}

const textSizes: Record<string, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
};

const colors: Record<string, string> = {
    dimmed: 'text-muted-foreground',
    red: 'text-destructive',
};

export function Text({
    c,
    size = 'md',
    fw,
    p,
    mt,
    className,
    ...props
}: ComponentProps<'p'> & {
    c?: string;
    size?: string;
    fw?: number;
    p?: string;
    mt?: string;
}) {
    const padding = p === 'xl' ? 'p-6' : p === 'lg' ? 'p-4' : p === 'md' ? 'p-3' : p ? 'p-2' : '';
    const weight = fw === 600 ? 'font-semibold' : fw ? 'font-medium' : '';
    const margin = mt === 'lg' ? 'mt-6' : mt === 'md' ? 'mt-4' : mt ? 'mt-2' : '';
    return (
        <p
            className={`${textSizes[size] ?? ''} ${colors[c ?? ''] ?? ''} ${weight} ${padding} ${margin} ${className ?? ''}`}
            {...props}
        />
    );
}

export function Title({
    order = 2,
    size,
    mb,
    className,
    ...props
}: ComponentProps<'h1'> & {
    order?: 1 | 2 | 3;
    size?: string;
    mb?: string;
}) {
    const Element = `h${order}` as 'h1' | 'h2' | 'h3';
    const sizeClass =
        size === 'h3' || order === 3
            ? 'text-lg'
            : order === 1
              ? 'text-2xl tracking-tight sm:text-3xl'
              : 'text-xl tracking-tight';
    const marginClass = mb === 'lg' ? 'mb-6' : mb ? 'mb-4' : '';
    return <Element className={`font-semibold ${sizeClass} ${marginClass} ${className ?? ''}`} {...props} />;
}

const paddings: Record<string, string> = {
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5 sm:p-6',
    xl: 'p-6 sm:p-8',
};

const radii: Record<string, string> = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
};

export function Card({
    p = 'md',
    radius = 'lg',
    withBorder: _withBorder,
    className,
    ...props
}: ComponentProps<typeof ShadcnCard> & {
    p?: string;
    radius?: string;
    withBorder?: boolean;
}) {
    return (
        <ShadcnCard
            className={`${paddings[p] ?? 'p-4'} ${radii[radius] ?? 'rounded-xl'} shadow-sm ${className ?? ''}`}
            {...props}
        />
    );
}

type ButtonProps = Omit<ComponentProps<typeof ShadcnButton>, 'variant'> & {
    variant?: 'default' | 'light' | 'subtle' | 'outline' | 'secondary' | 'ghost' | 'link' | 'filled';
    color?: string;
    loading?: boolean;
    mt?: string;
};

export function Button({
    variant = 'default',
    color,
    loading = false,
    disabled,
    type = 'button',
    mt,
    children,
    className,
    ...props
}: ButtonProps) {
    const mappedVariant =
        color === 'red'
            ? 'destructive'
            : variant === 'light'
              ? 'secondary'
              : variant === 'subtle'
                ? 'ghost'
                : variant === 'filled'
                  ? 'default'
                  : variant;
    return (
        <ShadcnButton
            variant={mappedVariant}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...props}
            className={`${mt === 'md' ? 'mt-4' : mt ? 'mt-2' : ''} ${className ?? ''}`}>
            {loading && (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            )}
            <Slottable>{children}</Slottable>
        </ShadcnButton>
    );
}

type FieldProps = ComponentProps<typeof Input> & {
    label?: string;
    description?: string;
};

export function TextInput({ label, description, className, id, ...props }: FieldProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
        <div className={`grid min-w-0 flex-1 gap-1.5 ${className ?? ''}`}>
            {label && <Label htmlFor={inputId}>{label}</Label>}
            <Input id={inputId} aria-describedby={description ? `${inputId}-description` : undefined} {...props} />
            {description && (
                <p id={`${inputId}-description`} className="text-muted-foreground text-sm">
                    {description}
                </p>
            )}
        </div>
    );
}

export function PasswordInput(props: FieldProps) {
    return <TextInput type="password" {...props} />;
}

type NumberInputProps = Omit<ComponentProps<'input'>, 'onChange' | 'type' | 'value'> & {
    label?: string;
    value: number | string;
    onChange: (value: number | string) => void;
};

export function NumberInput({ label, onChange, value, ...props }: NumberInputProps) {
    const id = useId();
    return (
        <div className="grid min-w-0 flex-1 gap-1.5">
            {label && <Label htmlFor={id}>{label}</Label>}
            <Input
                {...props}
                id={id}
                type="number"
                value={value}
                onChange={event => onChange(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))}
            />
        </div>
    );
}

type SelectOption = { value: string; label: string };
type SelectProps = Omit<ComponentProps<typeof ShadcnSelect>, 'defaultValue' | 'onValueChange' | 'value'> & {
    className?: string;
    label?: string;
    data: SelectOption[];
    value?: string | null;
    onChange: (value: string | null) => void;
    allowDeselect?: boolean;
    clearable?: boolean;
    placeholder?: string;
};

export function Select({
    label,
    data,
    value,
    onChange,
    allowDeselect: _allowDeselect,
    clearable = false,
    placeholder,
    className,
    disabled,
    required,
    name,
    ...props
}: SelectProps) {
    const id = useId();
    return (
        <div className={`grid min-w-0 flex-1 gap-1.5 ${className ?? ''}`}>
            {label && <Label htmlFor={id}>{label}</Label>}
            <ShadcnSelect
                value={value ?? undefined}
                onValueChange={selected => onChange(selected === '__clear__' ? null : selected)}
                disabled={disabled}
                required={required}
                name={name}
                {...props}>
                <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {clearable && <SelectItem value="__clear__">{placeholder ?? 'Aucun'}</SelectItem>}
                    {data.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </ShadcnSelect>
        </div>
    );
}

type AutocompleteProps = Omit<FieldProps, 'list' | 'onChange'> & {
    data: string[];
    onChange: (value: string) => void;
};

export function Autocomplete({ data, onChange, ...props }: AutocompleteProps) {
    const id = useId();
    return (
        <>
            <TextInput list={id} onChange={event => onChange(event.currentTarget.value)} {...props} />
            <datalist id={id}>
                {data.map(value => (
                    <option key={value} value={value} />
                ))}
            </datalist>
        </>
    );
}

type FileInputProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
    label?: string;
    value: File | null;
    onChange: (value: File | null) => void;
};

export function FileInput({ label, onChange, ...props }: FileInputProps) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const { value, ...inputProps } = props;
    useEffect(() => {
        if (!value && input.current) input.current.value = '';
    }, [value]);
    return (
        <div className="grid gap-1.5">
            {label && <Label htmlFor={id}>{label}</Label>}
            <Input
                {...inputProps}
                ref={input}
                id={id}
                type="file"
                onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.files?.[0] ?? null)}
            />
        </div>
    );
}

type AlertProps = ComponentProps<typeof ShadcnAlert> & {
    color?: string;
    title?: ReactNode;
};

export function Alert({ color, title, className, children, ...props }: AlertProps) {
    return (
        <ShadcnAlert
            variant={color === 'red' ? 'destructive' : 'default'}
            className={`${color === 'yellow' ? 'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100' : ''} ${className ?? ''}`}
            {...props}>
            {title && <AlertTitle>{title}</AlertTitle>}
            <AlertDescription>{children}</AlertDescription>
        </ShadcnAlert>
    );
}

export const Badge = ShadcnBadge;

type ProgressProps = ComponentProps<typeof ShadcnProgress> & { mt?: string };

export function Progress({ mt, className, ...props }: ProgressProps) {
    const marginClass = mt === 'md' ? 'mt-4' : mt === 'xs' ? 'mt-2' : '';
    return <ShadcnProgress className={`${marginClass} ${className ?? ''}`} {...props} />;
}

type ScrollContainerProps = ComponentProps<'div'> & { minWidth?: number };

function ScrollContainer({ minWidth, style, children, ...props }: ScrollContainerProps) {
    const contentStyle: CSSProperties | undefined = minWidth ? { minWidth } : undefined;
    return (
        <div className="w-full overflow-x-auto" {...props} style={style}>
            <div style={contentStyle}>{children}</div>
        </div>
    );
}

const Table = Object.assign(ShadcnTable, {
    ScrollContainer,
    Thead: TableHeader,
    Tbody: TableBody,
    Tr: TableRow,
    Th: TableHead,
    Td: TableCell,
});

export { Table };
