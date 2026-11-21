import { useQueryClient } from '@tanstack/react-query';
import { hc } from 'hono/client';
import { CheckCircle2, ChevronDown, FileText, HandCoins, Pencil, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import type { AppType } from '../server/app';
import {
    categoryLabelKey,
    MAX_CSV_BYTES,
    type ImportCategory,
    type ImportCategoryResolution,
} from '../server/import-csv';
import type { ImportPreview, ImportProposal } from '../server/import-preview';
import { displayDate } from '../shared/schedule';

import type { Settings } from './App';
import { PageHeading } from './components/PageHeading';
import {
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    FileInput,
    NumberInput,
    Stack,
    Table,
    Text,
} from './components/ui/primitives';
import {
    allocatedTotal,
    displayLine,
    setAllocationAmount,
    targetCapacities,
    toggleAllocation,
    visibleTargets,
    type FundingRow,
} from './importAttribution';
import { ImportCategoryDialog, type CategoryEditTarget } from './ImportCategoryDialog';
const api = hc<AppType>('/');
const money = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
const lineLabel = (row: number) => (row > 1 ? `Ligne ${displayLine(row)}` : row === 1 ? 'En-tête' : 'Fichier');

const csvFormats = [
    { separator: ';', label: 'Point-virgule' },
    { separator: ',', label: 'Virgule' },
] as const;

type Attribution = { row: number; allocations: ImportProposal['allocations'] };

export function ImportView({
    categories,
    paymentTypes,
    templates,
}: {
    categories: ImportCategory[];
    paymentTypes: ImportCategory[];
    templates: Settings['templates'];
}) {
    const client = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [csv, setCsv] = useState('');
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [categoryResolutions, setCategoryResolutions] = useState<ImportCategoryResolution[]>([]);
    const [editing, setEditing] = useState<CategoryEditTarget | null>(null);
    const [attribution, setAttribution] = useState<Attribution | null>(null);
    const [pinnedRows, setPinnedRows] = useState<ReadonlySet<number>>(new Set());
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const activeStep = preview ? 2 : file ? 1 : 0;
    const funding = attribution
        ? (preview?.rows.find((row): row is FundingRow => row.row === attribution.row && row.kind !== 'charge') ?? null)
        : null;
    const capacity = preview && attribution ? targetCapacities(preview, attribution.row) : new Map<string, number>();
    const shownTargets =
        preview && funding && attribution
            ? visibleTargets(preview.targets, funding, capacity, attribution.allocations)
            : [];
    const remaining = funding && attribution ? funding.amount - allocatedTotal(attribution.allocations) : 0;
    const tableRows = preview
        ? [
              ...preview.rows.map(row => ({ pending: false as const, row })),
              ...preview.pendingRows.map(row => ({ pending: true as const, row })),
          ].sort((a, b) => a.row.row - b.row.row)
        : [];

    useEffect(() => {
        if (!attribution) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) setAttribution(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [attribution]);
    const exampleCategory = categories[0]?.name ?? 'Nom exact de votre catégorie';
    const csvExamples = [
        ['date', 'libellé', 'crédit', 'débit'],
        ['31/01/2026', exampleCategory, '', '125,50'],
        ['01/02/2026', '', '100,00', ''],
        ['02/02/2026', exampleCategory, '', '-10,00'],
    ];

    async function send(
        content: string,
        commit: boolean,
        approvedDuplicates: string[],
        resolutions: ImportCategoryResolution[] = categoryResolutions,
        pinnedProposals: ImportProposal[] = preview?.proposals.filter(item => pinnedRows.has(item.row)) ?? [],
    ) {
        const res = await api.api.import.$post({
            json: {
                csv: content,
                commit,
                approvedDuplicates,
                categoryResolutions: resolutions,
                pinnedProposals,
                ...(commit && preview ? { snapshot: preview.snapshot, proposals: preview.proposals } : {}),
            },
        });
        if (!res.ok) {
            const body: unknown = await res.json();
            throw new Error(
                typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
                    ? body.error
                    : 'La requête d’import a échoué.',
            );
        }
        return res.json() as Promise<ImportPreview>;
    }

    async function inspect() {
        if (!file) return;
        setBusy(true);
        setError('');
        setNotice('');
        setPreview(null);
        setCategoryResolutions([]);
        setEditing(null);
        setAttribution(null);
        setPinnedRows(new Set());
        try {
            if (file.size > MAX_CSV_BYTES) throw new Error('Fichier trop volumineux (maximum 1 Mo).');
            const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
            const result = await send(content, false, [], [], []);
            setCsv(content);
            setPreview(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Impossible de lire le fichier.');
        } finally {
            setBusy(false);
        }
    }

    async function updateCategoryResolution(
        label: string,
        targetKind: 'charge' | 'payment',
        resolution: ImportCategoryResolution | null,
    ) {
        const key = categoryLabelKey(label);
        const next = categoryResolutions.filter(
            item =>
                categoryLabelKey(item.label) !== key
                || (item.kind === 'existing' ? (item.targetKind ?? 'charge') : 'charge') !== targetKind,
        );
        if (resolution) next.push(resolution);
        setCategoryResolutions(next);
        setBusy(true);
        setError('');
        setNotice('');
        try {
            setPreview(await send(csv, false, [], next));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Impossible de vérifier cette catégorie.');
        } finally {
            setBusy(false);
        }
    }

    async function commit() {
        if (!preview || preview.errors.length || preview.unresolvedCategories.length) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await send(
                csv,
                true,
                preview.duplicates.map(item => item.marker),
            );
            if (!result.imported) {
                setPreview(result);
                await client.invalidateQueries({ queryKey: ['settings'] });
                setNotice('Les doublons ou les données ont changé. Vérifiez le nouvel aperçu avant de confirmer.');
                return;
            }
            setNotice(`${result.rows.length} mouvement(s) importé(s).`);
            setPreview(null);
            setCsv('');
            setFile(null);
            setCategoryResolutions([]);
            setPinnedRows(new Set());
            await Promise.all([
                client.invalidateQueries({ queryKey: ['charges'] }),
                client.invalidateQueries({ queryKey: ['payments'] }),
                client.invalidateQueries({ queryKey: ['refunds'] }),
                client.invalidateQueries({ queryKey: ['settings'] }),
            ]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Import impossible.');
        } finally {
            setBusy(false);
        }
    }

    function updateProposal(row: number, allocations: ImportProposal['allocations']) {
        setPreview(current =>
            current
                ? {
                      ...current,
                      errors: current.errors.filter(item => item.column !== 'répartition'),
                      proposals: current.proposals.map(item => (item.row === row ? { row, allocations } : item)),
                  }
                : current,
        );
    }

    function resolutionFor(label: string, targetKind: 'charge' | 'payment') {
        return categoryResolutions.find(
            value =>
                categoryLabelKey(value.label) === categoryLabelKey(label)
                && (value.kind === 'existing'
                    ? (value.targetKind ?? 'charge') === targetKind
                    : targetKind === 'charge'),
        );
    }

    function openCategoryEditor(label: string, targetKind: 'charge' | 'payment', current: string | null) {
        const group = preview?.categoryLabels.find(
            item => item.targetKind === targetKind && categoryLabelKey(item.label) === categoryLabelKey(label),
        );
        setEditing({ label: group?.label ?? label, targetKind, rows: group?.rows ?? [], current });
    }

    function confirmAttribution() {
        if (!attribution) return;
        updateProposal(
            attribution.row,
            attribution.allocations.filter(item => item.amount > 0),
        );
        setPinnedRows(current => new Set(current).add(attribution.row));
        setAttribution(null);
    }

    return (
        <Stack gap="lg">
            <PageHeading
                eyebrow="Ajout de données"
                title="Importer un CSV"
                description="Analysez un relevé, vérifiez les lignes détectées et confirmez uniquement après contrôle."
            />
            <ol aria-label="Étapes d’import" className="grid gap-2 sm:grid-cols-3">
                {['Choisir un fichier', 'Vérifier l’aperçu', 'Confirmer l’import'].map((step, index) => {
                    const complete = index < activeStep;
                    const current = index === activeStep;
                    return (
                        <li
                            key={step}
                            aria-current={current ? 'step' : undefined}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${current ? 'border-primary/40 bg-accent/50' : 'bg-card'}`}>
                            <span
                                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${complete || current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {complete ? <CheckCircle2 className="size-4" aria-hidden="true" /> : index + 1}
                            </span>
                            <span className={`text-sm ${current ? 'font-medium' : 'text-muted-foreground'}`}>
                                {step}
                            </span>
                        </li>
                    );
                })}
            </ol>
            <Card p="lg" className="gap-5">
                <div className="flex items-start gap-3">
                    <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-lg">
                        <Upload className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="font-semibold">Sélectionner un relevé</h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Formats CSV UTF-8 · jusqu’à 1 Mo et 1 000 lignes.
                        </p>
                    </div>
                </div>
                <div className="grid gap-4">
                    <FileInput
                        label="Fichier CSV UTF-8"
                        accept=".csv,text/csv"
                        value={file}
                        disabled={busy}
                        onChange={value => {
                            setFile(value);
                            setPreview(null);
                            setCsv('');
                            setCategoryResolutions([]);
                            setEditing(null);
                            setAttribution(null);
                            setPinnedRows(new Set());
                            setNotice('');
                            setError('');
                        }}
                    />
                </div>
                <details className="group bg-muted/50 rounded-lg p-4">
                    <summary className="focus-visible:outline-ring flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                        <h3 id="csv-format-title" className="text-sm font-semibold">
                            Format du CSV
                        </h3>
                        <ChevronDown
                            className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                            aria-hidden="true"
                        />
                    </summary>
                    <div className="mt-3 grid min-w-0 gap-3">
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-sm">
                                Exactement quatre colonnes : <code>date, libellé, crédit, débit</code>, dans l’ordre
                                souhaité. Les noms anglais <code>date, label, credit, debit</code> sont aussi acceptés,
                                sans distinction de casse ou d’accent. Les anciens formats type/amount ne sont plus
                                acceptés. Utilisez une virgule (,) ou un point-virgule (;) comme séparateur, identique
                                partout.
                            </p>
                            <p className="text-muted-foreground text-sm">
                                Dates : <code>JJ/MM/AAAA</code> ou <code>AAAA-MM-JJ</code>. Si le séparateur est une
                                virgule, mettez les montants à virgule décimale entre guillemets (ex.{' '}
                                <code>"125,50"</code>).
                            </p>
                            <ul className="text-muted-foreground list-disc space-y-1 ps-4 text-sm">
                                <li>
                                    Un débit positif crée une charge ; un débit négatif crée un remboursement (avoir),
                                    jamais un paiement en espèces.
                                </li>
                                <li>
                                    Les correspondances CSV de{' '}
                                    <Link className="text-foreground underline underline-offset-4" to="/settings">
                                        Paramètres
                                    </Link>{' '}
                                    attribuent une catégorie aux débits et un type aux paiements. Vous pouvez ajuster
                                    chaque correspondance dans l’aperçu. Sans règle, les débits sont associés à une
                                    catégorie existante exacte ou choisie/créée dans l’aperçu ; les paiements non
                                    reconnus restent « Paiement importé » jusqu’à un choix manuel.
                                </li>
                                <li>
                                    Un crédit positif crée un paiement. Son libellé peut être vide, mais la colonne
                                    libellé reste obligatoire. Un crédit négatif est refusé.
                                </li>
                                <li>
                                    Renseignez un seul montant non nul par ligne ; laissez l’autre côté vide ou à zéro.
                                    Montants en euros, deux décimales au maximum, sans symbole ni séparateur de
                                    milliers.
                                </li>
                            </ul>
                            <p className="text-muted-foreground text-sm">
                                Catégories disponibles :{' '}
                                {categories.length
                                    ? categories.map(item => item.name).join(' · ')
                                    : 'aucune — créez une catégorie dans Paramètres avant d’importer des débits.'}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                L’aperçu propose d’abord les avoirs sur les charges antérieures de même catégorie, puis
                                les paiements sur les plus anciennes charges encore dues. Vous pouvez choisir d’autres
                                charges antérieures ou conserver le crédit non affecté avant de confirmer. Les
                                excédents, y compris les avoirs, restent inclus dans le solde sans être comptés deux
                                fois.
                            </p>
                        </div>
                        {csvFormats.map(({ separator, label }) => (
                            <figure key={separator} className="min-w-0 space-y-1">
                                <figcaption className="text-xs font-medium">
                                    {label} ({separator})
                                </figcaption>
                                <pre className="bg-card rounded-md border p-2 text-xs leading-5 break-all whitespace-pre-wrap">
                                    <code>
                                        {csvExamples
                                            .map(row =>
                                                row
                                                    .map(field =>
                                                        /["\r\n]/.test(field) || field.includes(separator)
                                                            ? `"${field.replaceAll('"', '""')}"`
                                                            : field,
                                                    )
                                                    .join(separator),
                                            )
                                            .join('\n')}
                                    </code>
                                </pre>
                            </figure>
                        ))}
                    </div>
                </details>
                {file && (
                    <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{file.name}</p>
                                <p className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(0)} Ko</p>
                            </div>
                        </div>
                        <Badge variant="outline">Prêt à analyser</Badge>
                    </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="text-muted-foreground max-w-2xl text-xs leading-5">
                        L’analyse ne modifie aucun mouvement. Vérifiez et ajustez les répartitions proposées avant toute
                        confirmation.
                    </p>
                    <Button onClick={inspect} disabled={!file} loading={busy}>
                        <Upload aria-hidden="true" /> Analyser le fichier
                    </Button>
                </div>
            </Card>
            {error && (
                <Alert color="red" role="alert">
                    {error}
                </Alert>
            )}
            {notice && <Alert role="status">{notice}</Alert>}
            {preview && (
                <Card p="sm" className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-4 sm:px-4">
                        <div className="flex items-start gap-3">
                            <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-lg">
                                <FileText className="size-4" aria-hidden="true" />
                            </span>
                            <div>
                                <h2 className="font-semibold">Vérifier l’aperçu</h2>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {preview.rows.length} ligne(s) détectée(s) · rien n’est encore importé.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{preview.rows.length} valide(s)</Badge>
                            {preview.errors.length > 0 && (
                                <Badge variant="destructive">{preview.errors.length} erreur(s)</Badge>
                            )}
                            {preview.duplicates.length > 0 && (
                                <Badge variant="secondary">{preview.duplicates.length} doublon(s) possible(s)</Badge>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4 p-3 sm:p-4">
                        {preview.errors.length > 0 && (
                            <Alert color="red" title="Import bloqué : corrigez les lignes signalées" role="alert">
                                {preview.errors.map((item, index) => (
                                    <Text key={index} size="sm">
                                        {lineLabel(item.row)}, {item.column} : {item.message}
                                    </Text>
                                ))}
                                <Link className="underline underline-offset-4" to="/settings">
                                    Gérer les catégories dans Paramètres
                                </Link>
                            </Alert>
                        )}
                        {preview.unresolvedCategories.length > 0 && !funding && (
                            <Alert color="yellow" title="Catégories à définir">
                                {preview.unresolvedCategories.length} libellé(s) sans catégorie. Utilisez le bouton
                                crayon de la colonne Catégorie pour en choisir une ou en créer une.
                            </Alert>
                        )}
                        {preview.duplicates.length > 0 && !funding && (
                            <Alert color="yellow" title="Doublons possibles">
                                Vérifiez les lignes{' '}
                                {Array.from(new Set(preview.duplicates.map(item => displayLine(item.row)))).join(', ')}.
                                La confirmation importera aussi ces lignes.
                            </Alert>
                        )}
                        {funding && attribution ? (
                            <>
                                <p id="attribution-help" className="text-muted-foreground text-sm">
                                    Cochez les charges à régler avec{' '}
                                    {funding.kind === 'refund' ? 'cet avoir' : 'ce paiement'}. Seules les charges non
                                    soldées datées au plus tard du {displayDate(funding.date)}
                                    {funding.kind === 'refund' ? ', de la même catégorie,' : ''} sont affichées.
                                    {funding.kind === 'refund'
                                        ? ' L’avoir réduit la dette, pas le total des paiements reçus.'
                                        : ''}
                                </p>
                                <Table.ScrollContainer minWidth={760}>
                                    <Table aria-describedby="attribution-help">
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th className="w-10">
                                                    <span className="sr-only">Sélection</span>
                                                </Table.Th>
                                                <Table.Th>Ligne</Table.Th>
                                                <Table.Th>Date</Table.Th>
                                                <Table.Th>Nature</Table.Th>
                                                <Table.Th>Libellé</Table.Th>
                                                <Table.Th>Catégorie</Table.Th>
                                                <Table.Th className="text-end">Montant</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            <Table.Tr className="bg-accent/60 hover:bg-accent/60">
                                                <Table.Td>
                                                    <HandCoins className="text-primary size-4" aria-hidden="true" />
                                                </Table.Td>
                                                <Table.Td>{displayLine(funding.row)}</Table.Td>
                                                <Table.Td>{displayDate(funding.date)}</Table.Td>
                                                <Table.Td>
                                                    {funding.kind === 'refund' ? 'Remboursement (avoir)' : 'Paiement'}
                                                </Table.Td>
                                                <Table.Td className="max-w-72 truncate">
                                                    {funding.kind === 'refund' ? funding.title : (funding.label ?? '—')}
                                                </Table.Td>
                                                <Table.Td>{funding.category}</Table.Td>
                                                <Table.Td className="text-end font-mono font-medium tabular-nums">
                                                    {money(funding.amount)}
                                                </Table.Td>
                                            </Table.Tr>
                                            {shownTargets.map(target => {
                                                const selected = attribution.allocations.find(
                                                    item => item.target === target.key,
                                                );
                                                const owed = capacity.get(target.key) ?? 0;
                                                const disabled = busy || (!selected && (remaining <= 0 || owed <= 0));
                                                const existing = target.key.startsWith('charge:');
                                                const line = existing
                                                    ? null
                                                    : displayLine(Number(target.key.slice('row:'.length)));
                                                const name = `${target.title} (${line === null ? 'charge existante' : `ligne ${line}`})`;
                                                return (
                                                    <Table.Tr
                                                        key={target.key}
                                                        data-state={selected ? 'selected' : undefined}
                                                        className={
                                                            disabled && !selected ? 'text-muted-foreground' : undefined
                                                        }>
                                                        <Table.Td>
                                                            <Checkbox
                                                                aria-label={`Attribuer à ${name}`}
                                                                checked={Boolean(selected)}
                                                                disabled={disabled}
                                                                onCheckedChange={() =>
                                                                    setAttribution({
                                                                        ...attribution,
                                                                        allocations: toggleAllocation(
                                                                            attribution.allocations,
                                                                            target.key,
                                                                            owed,
                                                                            funding.amount,
                                                                        ),
                                                                    })
                                                                }
                                                            />
                                                        </Table.Td>
                                                        <Table.Td>{line ?? '—'}</Table.Td>
                                                        <Table.Td>{displayDate(target.date)}</Table.Td>
                                                        <Table.Td>
                                                            <span className="flex items-center gap-2">
                                                                Charge
                                                                {existing && <Badge variant="outline">Existante</Badge>}
                                                            </span>
                                                        </Table.Td>
                                                        <Table.Td className="max-w-72 truncate">
                                                            {target.title}
                                                        </Table.Td>
                                                        <Table.Td>{target.category}</Table.Td>
                                                        <Table.Td className="text-end">
                                                            {selected ? (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <NumberInput
                                                                        aria-label={`Montant attribué à ${name} (€)`}
                                                                        className="w-28 text-end tabular-nums"
                                                                        min={0}
                                                                        max={owed / 100}
                                                                        step={0.01}
                                                                        value={selected.amount / 100}
                                                                        disabled={busy}
                                                                        onChange={value =>
                                                                            setAttribution({
                                                                                ...attribution,
                                                                                allocations: setAllocationAmount(
                                                                                    attribution.allocations,
                                                                                    target.key,
                                                                                    typeof value === 'number'
                                                                                        ? value * 100
                                                                                        : 0,
                                                                                    owed,
                                                                                    funding.amount,
                                                                                ),
                                                                            })
                                                                        }
                                                                    />
                                                                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                                                                        sur {money(owed)}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="font-mono tabular-nums">
                                                                    {money(owed)}{' '}
                                                                    <span className="text-muted-foreground font-sans text-xs">
                                                                        dû
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                            {shownTargets.length === 0 && (
                                                <Table.Tr>
                                                    <Table.Td
                                                        colSpan={7}
                                                        className="text-muted-foreground py-8 text-center">
                                                        Aucune charge éligible à régler.
                                                    </Table.Td>
                                                </Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Table.ScrollContainer>
                            </>
                        ) : tableRows.length > 0 ? (
                            <Table.ScrollContainer minWidth={760}>
                                <Table>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Ligne</Table.Th>
                                            <Table.Th>Date</Table.Th>
                                            <Table.Th>Nature</Table.Th>
                                            <Table.Th>Libellé</Table.Th>
                                            <Table.Th>Catégorie</Table.Th>
                                            <Table.Th className="text-end">Montant</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {tableRows.map(({ pending, row }) => {
                                            const label = row.kind === 'payment' ? row.label : row.title;
                                            const targetKind = row.kind === 'payment' ? 'payment' : 'charge';
                                            const resolution = label ? resolutionFor(label, targetKind) : undefined;
                                            const category = !pending && 'category' in row ? row.category : null;
                                            const proposal =
                                                pending || row.kind === 'charge'
                                                    ? undefined
                                                    : preview.proposals.find(item => item.row === row.row);
                                            const unallocated = proposal
                                                ? row.amount - allocatedTotal(proposal.allocations)
                                                : 0;
                                            return (
                                                <Table.Tr key={row.row}>
                                                    <Table.Td>{displayLine(row.row)}</Table.Td>
                                                    <Table.Td>{displayDate(row.date)}</Table.Td>
                                                    <Table.Td>
                                                        {row.kind === 'charge'
                                                            ? 'Charge'
                                                            : row.kind === 'refund'
                                                              ? 'Remboursement (avoir)'
                                                              : 'Paiement'}
                                                    </Table.Td>
                                                    <Table.Td className="max-w-72 truncate">{label ?? '—'}</Table.Td>
                                                    <Table.Td>
                                                        <div className="flex min-w-0 items-center gap-1.5">
                                                            {category === null ? (
                                                                <Badge variant="destructive">À définir</Badge>
                                                            ) : (
                                                                <span className="truncate">{category}</span>
                                                            )}
                                                            {resolution?.kind === 'new' && (
                                                                <Badge variant="secondary">Nouvelle</Badge>
                                                            )}
                                                            {label && (
                                                                <Button
                                                                    variant="subtle"
                                                                    size="icon-sm"
                                                                    className="ms-auto shrink-0"
                                                                    title={
                                                                        targetKind === 'payment'
                                                                            ? 'Modifier le type de paiement'
                                                                            : 'Modifier la catégorie'
                                                                    }
                                                                    aria-label={`Modifier ${targetKind === 'payment' ? 'le type de paiement' : 'la catégorie'} du libellé « ${label} »`}
                                                                    disabled={busy}
                                                                    onClick={() =>
                                                                        openCategoryEditor(label, targetKind, category)
                                                                    }>
                                                                    <Pencil aria-hidden="true" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </Table.Td>
                                                    <Table.Td className="text-end">
                                                        {proposal ? (
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <div>
                                                                    <span className="block font-mono tabular-nums">
                                                                        {money(row.amount)}
                                                                    </span>
                                                                    <span className="text-muted-foreground block text-xs">
                                                                        {unallocated > 0
                                                                            ? `${money(unallocated)} non attribué`
                                                                            : 'Entièrement attribué'}
                                                                    </span>
                                                                </div>
                                                                <Button
                                                                    variant="subtle"
                                                                    size="icon-sm"
                                                                    title="Attribuer aux charges"
                                                                    aria-label={`Attribuer le montant de la ligne ${displayLine(row.row)} aux charges`}
                                                                    disabled={busy}
                                                                    onClick={() =>
                                                                        setAttribution({
                                                                            row: row.row,
                                                                            allocations: proposal.allocations,
                                                                        })
                                                                    }>
                                                                    <HandCoins aria-hidden="true" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span className="font-mono tabular-nums">
                                                                {money(row.amount)}
                                                            </span>
                                                        )}
                                                    </Table.Td>
                                                </Table.Tr>
                                            );
                                        })}
                                    </Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                        ) : (
                            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                                Aucune ligne valide à afficher.
                            </p>
                        )}
                    </div>
                    {!funding && (
                        <div className="bg-muted/30 flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-muted-foreground text-xs leading-5">
                                Vérifiez les dates, montants et doublons. La confirmation est nécessaire pour
                                enregistrer les données.
                            </p>
                            <Button
                                onClick={commit}
                                disabled={
                                    preview.errors.length > 0
                                    || preview.unresolvedCategories.length > 0
                                    || !preview.rows.length
                                    || busy
                                }
                                loading={busy}>
                                {preview.duplicates.length ? 'Confirmer avec les doublons' : 'Confirmer l’import'}
                            </Button>
                        </div>
                    )}
                </Card>
            )}
            {funding && attribution && (
                <>
                    <div aria-hidden="true" className="h-28" />
                    <div
                        role="region"
                        aria-label="Attribution en cours"
                        className="bg-background/80 supports-[backdrop-filter]:bg-background/70 fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-xl border shadow-lg backdrop-blur-md sm:inset-x-6 sm:bottom-6">
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0" aria-live="polite">
                                {remaining > 0 ? (
                                    <>
                                        <p className="text-muted-foreground text-xs">Reste à attribuer</p>
                                        <p className="text-sm">
                                            <span className="font-mono text-lg font-semibold tabular-nums">
                                                {money(remaining)}
                                            </span>{' '}
                                            <span className="text-muted-foreground">
                                                sur {money(funding.amount)} · ligne {displayLine(funding.row)}
                                            </span>
                                        </p>
                                    </>
                                ) : (
                                    <p className="flex items-center gap-2.5 text-sm">
                                        <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-full">
                                            <CheckCircle2 className="size-4" aria-hidden="true" />
                                        </span>
                                        <span>
                                            <span className="block font-medium">Montant entièrement attribué</span>
                                            <span className="text-muted-foreground block text-xs">
                                                Les {money(funding.amount)} sont répartis. Décochez une charge pour en
                                                choisir une autre.
                                            </span>
                                        </span>
                                    </p>
                                )}
                            </div>
                            <div className="flex shrink-0 justify-end gap-2">
                                <Button variant="outline" onClick={() => setAttribution(null)}>
                                    Annuler
                                </Button>
                                <Button onClick={confirmAttribution} disabled={busy}>
                                    OK
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {editing && (
                <ImportCategoryDialog
                    target={editing}
                    resolution={resolutionFor(editing.label, editing.targetKind)}
                    options={editing.targetKind === 'payment' ? paymentTypes : categories}
                    templates={templates}
                    onClose={() => setEditing(null)}
                    onApply={resolution => {
                        const target = editing;
                        setEditing(null);
                        void updateCategoryResolution(target.label, target.targetKind, resolution);
                    }}
                />
            )}
        </Stack>
    );
}
