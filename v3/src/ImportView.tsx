import { useQueryClient } from '@tanstack/react-query';
import { hc } from 'hono/client';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import { useState } from 'react';
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
    FileInput,
    NumberInput,
    Select,
    Stack,
    Table,
    Text,
    TextInput,
} from './components/ui/primitives';
const api = hc<AppType>('/');
const money = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);

const csvFormats = [
    { separator: ';', label: 'Point-virgule' },
    { separator: ',', label: 'Virgule' },
] as const;

type CategoryDraft = { name: string; defaultScheduleId: string | null };

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
    const [categoryLabels, setCategoryLabels] = useState<ImportPreview['categoryLabels']>([]);
    const [categoryResolutions, setCategoryResolutions] = useState<ImportCategoryResolution[]>([]);
    const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
    const [creatingCategoryFor, setCreatingCategoryFor] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const activeStep = preview ? 2 : file ? 1 : 0;
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
    ) {
        const res = await api.api.import.$post({
            json: {
                csv: content,
                commit,
                approvedDuplicates,
                categoryResolutions: resolutions,
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
        setCategoryLabels([]);
        setCategoryResolutions([]);
        setCategoryDrafts({});
        setCreatingCategoryFor(null);
        try {
            if (file.size > MAX_CSV_BYTES) throw new Error('Fichier trop volumineux (maximum 1 Mo).');
            const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
            const result = await send(content, false, [], []);
            setCsv(content);
            setCategoryLabels(result.categoryLabels);
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
                setCategoryLabels(result.categoryLabels);
                await client.invalidateQueries({ queryKey: ['settings'] });
                setNotice('Les doublons ou les données ont changé. Vérifiez le nouvel aperçu avant de confirmer.');
                return;
            }
            setNotice(`${result.rows.length} mouvement(s) importé(s).`);
            setPreview(null);
            setCsv('');
            setFile(null);
            setCategoryLabels([]);
            setCategoryResolutions([]);
            setCategoryDrafts({});
            setCreatingCategoryFor(null);
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
                            setCategoryLabels([]);
                            setCategoryResolutions([]);
                            setCategoryDrafts({});
                            setCreatingCategoryFor(null);
                            setNotice('');
                            setError('');
                        }}
                    />
                </div>
                <section aria-labelledby="csv-format-title" className="bg-muted/50 grid min-w-0 gap-3 rounded-lg p-4">
                    <div className="space-y-1">
                        <h3 id="csv-format-title" className="text-sm font-semibold">
                            Format du CSV
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            Exactement quatre colonnes : <code>date, libellé, crédit, débit</code>, dans l’ordre
                            souhaité. Les noms anglais <code>date, label, credit, debit</code> sont aussi acceptés, sans
                            distinction de casse ou d’accent. Les anciens formats type/amount ne sont plus acceptés.
                            Utilisez une virgule (,) ou un point-virgule (;) comme séparateur, identique partout.
                        </p>
                        <p className="text-muted-foreground text-sm">
                            Dates : <code>JJ/MM/AAAA</code> ou <code>AAAA-MM-JJ</code>. Si le séparateur est une
                            virgule, mettez les montants à virgule décimale entre guillemets (ex. <code>"125,50"</code>
                            ).
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
                                attribuent une catégorie aux débits et un type aux paiements. Vous pouvez ajuster chaque
                                correspondance dans l’aperçu. Sans règle, les débits sont associés à une catégorie
                                existante exacte ou choisie/créée dans l’aperçu ; les paiements non reconnus restent «
                                Paiement importé » jusqu’à un choix manuel.
                            </li>
                            <li>
                                Un crédit positif crée un paiement. Son libellé peut être vide, mais la colonne libellé
                                reste obligatoire. Un crédit négatif est refusé.
                            </li>
                            <li>
                                Renseignez un seul montant non nul par ligne ; laissez l’autre côté vide ou à zéro.
                                Montants en euros, deux décimales au maximum, sans symbole ni séparateur de milliers.
                            </li>
                        </ul>
                        <p className="text-muted-foreground text-sm">
                            Catégories disponibles :{' '}
                            {categories.length
                                ? categories.map(item => item.name).join(' · ')
                                : 'aucune — créez une catégorie dans Paramètres avant d’importer des débits.'}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            L’aperçu propose d’abord les avoirs sur les charges antérieures de même catégorie, puis les
                            paiements sur les plus anciennes charges encore dues. Vous pouvez choisir d’autres charges
                            antérieures ou conserver le crédit non affecté avant de confirmer. Les excédents, y compris
                            les avoirs, restent inclus dans le solde sans être comptés deux fois.
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
                </section>
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
                                        Ligne {item.row}, {item.column} : {item.message}
                                    </Text>
                                ))}
                                <Link className="underline underline-offset-4" to="/settings">
                                    Gérer les catégories dans Paramètres
                                </Link>
                            </Alert>
                        )}
                        {categoryLabels.length > 0 && (
                            <section
                                aria-labelledby="import-categories-title"
                                className="space-y-3 rounded-lg border p-3 sm:p-4">
                                <div className="space-y-1">
                                    <h3 id="import-categories-title" className="text-sm font-semibold">
                                        Vérifier les correspondances automatiques
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        La première règle correspondante est appliquée. Vous pouvez remplacer le choix
                                        pour toutes les lignes portant le même libellé. Une catégorie créée ici ne sera
                                        enregistrée qu’après confirmation de l’import.
                                    </p>
                                </div>
                                {categoryLabels.map(item => {
                                    const key = `${item.targetKind}:${categoryLabelKey(item.label)}`;
                                    const resolution = categoryResolutions.find(
                                        value =>
                                            categoryLabelKey(value.label) === categoryLabelKey(item.label)
                                            && (value.kind === 'existing'
                                                ? (value.targetKind ?? 'charge') === item.targetKind
                                                : item.targetKind === 'charge'),
                                    );
                                    const initialDraft: CategoryDraft = {
                                        name: item.label.trim().slice(0, 80),
                                        defaultScheduleId: null,
                                    };
                                    const draft = categoryDrafts[key] ?? initialDraft;
                                    const updateDraft = (updates: Partial<CategoryDraft>) =>
                                        setCategoryDrafts(current => ({
                                            ...current,
                                            [key]: { ...(current[key] ?? initialDraft), ...updates },
                                        }));
                                    const creating = creatingCategoryFor === key;
                                    return (
                                        <div key={key} className="bg-muted/40 grid gap-3 rounded-md p-3 sm:grid-cols-2">
                                            <div className="space-y-1 sm:col-span-2">
                                                <p className="text-sm font-medium break-words">{item.label}</p>
                                                <p className="text-muted-foreground text-xs">
                                                    {item.targetKind === 'payment'
                                                        ? 'Paiement'
                                                        : 'Charge ou remboursement'}{' '}
                                                    · {item.rows.length} ligne(s) : {item.rows.join(', ')}
                                                </p>
                                                <p className="text-muted-foreground text-xs">
                                                    Correspondance actuelle :{' '}
                                                    {preview.rows.find(row => item.rows.includes(row.row))?.category
                                                        ?? (item.targetKind === 'payment'
                                                            ? 'Paiement importé'
                                                            : 'À associer')}
                                                </p>
                                                {resolution?.kind === 'new' && (
                                                    <p role="status" className="text-sm">
                                                        Nouvelle catégorie en attente : {resolution.name}
                                                    </p>
                                                )}
                                            </div>
                                            <Select
                                                label={
                                                    item.targetKind === 'payment'
                                                        ? 'Type de paiement'
                                                        : 'Catégorie existante'
                                                }
                                                value={resolution?.kind === 'existing' ? resolution.categoryId : null}
                                                disabled={busy}
                                                clearable
                                                placeholder="Automatique"
                                                data={(item.targetKind === 'payment' ? paymentTypes : categories).map(
                                                    category => ({
                                                        value: category.id,
                                                        label: category.name,
                                                    }),
                                                )}
                                                onChange={value => {
                                                    setCreatingCategoryFor(null);
                                                    void updateCategoryResolution(
                                                        item.label,
                                                        item.targetKind,
                                                        value
                                                            ? {
                                                                  label: item.label,
                                                                  kind: 'existing',
                                                                  categoryId: value,
                                                                  targetKind: item.targetKind,
                                                              }
                                                            : null,
                                                    );
                                                }}
                                            />
                                            {item.targetKind === 'charge' && (
                                                <div className="flex flex-wrap items-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        disabled={busy}
                                                        onClick={() => setCreatingCategoryFor(creating ? null : key)}>
                                                        {creating ? 'Masquer la création' : 'Créer une catégorie'}
                                                    </Button>
                                                    {resolution?.kind === 'new' && (
                                                        <Button
                                                            variant="subtle"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void updateCategoryResolution(
                                                                    item.label,
                                                                    item.targetKind,
                                                                    null,
                                                                )
                                                            }>
                                                            Annuler cette catégorie
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                            {creating && (
                                                <div className="grid gap-3 rounded-md border p-3 sm:col-span-2">
                                                    <TextInput
                                                        label="Nom de la catégorie"
                                                        required
                                                        maxLength={80}
                                                        value={draft.name}
                                                        disabled={busy}
                                                        onChange={event =>
                                                            updateDraft({ name: event.currentTarget.value })
                                                        }
                                                    />
                                                    <Select
                                                        label="Échéancier par défaut (facultatif)"
                                                        value={draft.defaultScheduleId}
                                                        disabled={busy}
                                                        clearable
                                                        placeholder="Aucun échéancier"
                                                        data={templates.map(template => ({
                                                            value: template.id,
                                                            label: template.name,
                                                        }))}
                                                        onChange={value => updateDraft({ defaultScheduleId: value })}
                                                    />
                                                    <Button
                                                        disabled={busy || !draft.name.trim()}
                                                        onClick={() =>
                                                            void updateCategoryResolution(item.label, item.targetKind, {
                                                                label: item.label,
                                                                kind: 'new',
                                                                name: draft.name,
                                                                defaultScheduleId: draft.defaultScheduleId,
                                                            })
                                                        }>
                                                        {resolution?.kind === 'new'
                                                            ? 'Mettre à jour la catégorie'
                                                            : 'Utiliser cette catégorie'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </section>
                        )}
                        {preview.duplicates.length > 0 && (
                            <Alert color="yellow" title="Doublons possibles">
                                Vérifiez les lignes{' '}
                                {Array.from(new Set(preview.duplicates.map(item => item.row))).join(', ')}. La
                                confirmation importera aussi ces lignes.
                            </Alert>
                        )}
                        {preview.rows.length > 0 ? (
                            <Table.ScrollContainer minWidth={720}>
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
                                        {preview.rows.map(row => (
                                            <Table.Tr key={row.row}>
                                                <Table.Td>{row.row}</Table.Td>
                                                <Table.Td>{displayDate(row.date)}</Table.Td>
                                                <Table.Td>
                                                    {row.kind === 'charge'
                                                        ? 'Charge'
                                                        : row.kind === 'refund'
                                                          ? 'Remboursement (avoir)'
                                                          : 'Paiement'}
                                                </Table.Td>
                                                <Table.Td className="max-w-72 truncate">
                                                    {row.kind !== 'payment' ? row.title : (row.label ?? '—')}
                                                </Table.Td>
                                                <Table.Td>{row.category}</Table.Td>
                                                <Table.Td className="text-end font-mono tabular-nums">
                                                    {money(row.amount)}
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                        ) : (
                            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                                Aucune ligne valide à afficher.
                            </p>
                        )}
                        {preview.proposals.map(proposal => {
                            const row = preview.rows.find(item => item.row === proposal.row);
                            if (!row) return null;
                            const used = proposal.allocations.reduce((sum, item) => sum + item.amount, 0);
                            const eligible = preview.targets.filter(target => target.date <= row.date);
                            return (
                                <section
                                    key={proposal.row}
                                    aria-labelledby={`allocation-${proposal.row}`}
                                    className="space-y-3 rounded-lg border p-3">
                                    <h3 id={`allocation-${proposal.row}`} className="text-sm font-semibold">
                                        Ligne {proposal.row} · {row.kind === 'refund' ? 'Avoir' : 'Paiement'} ·{' '}
                                        {money(row.amount)}
                                    </h3>
                                    <p className="text-muted-foreground text-xs">
                                        Non affecté : {money(row.amount - used)}.
                                        {row.kind === 'refund'
                                            ? ' L’avoir réduit la dette, pas le total des paiements reçus.'
                                            : ''}
                                    </p>
                                    {proposal.allocations.map((allocation, index) => (
                                        <div
                                            key={index}
                                            className="grid min-w-0 items-end gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
                                            <Select
                                                label={`Charge · ligne ${proposal.row}, répartition ${index + 1}`}
                                                value={allocation.target}
                                                disabled={busy}
                                                allowDeselect={false}
                                                data={eligible.map(target => ({
                                                    value: target.key,
                                                    label: `${displayDate(target.date)} · ${target.title} · ${money(target.remaining)}`,
                                                }))}
                                                onChange={value => {
                                                    if (!value) return;
                                                    updateProposal(
                                                        proposal.row,
                                                        proposal.allocations.map((item, position) =>
                                                            position === index ? { ...item, target: value } : item,
                                                        ),
                                                    );
                                                }}
                                            />
                                            <NumberInput
                                                label={`Montant (€) · ligne ${proposal.row}, répartition ${index + 1}`}
                                                min={0.01}
                                                step={0.01}
                                                value={allocation.amount / 100}
                                                disabled={busy}
                                                onChange={value =>
                                                    updateProposal(
                                                        proposal.row,
                                                        proposal.allocations.map((item, position) =>
                                                            position === index
                                                                ? {
                                                                      ...item,
                                                                      amount:
                                                                          typeof value === 'number'
                                                                              ? Math.round(value * 100)
                                                                              : 0,
                                                                  }
                                                                : item,
                                                        ),
                                                    )
                                                }
                                            />
                                            <Button
                                                variant="outline"
                                                disabled={busy}
                                                onClick={() =>
                                                    updateProposal(
                                                        proposal.row,
                                                        proposal.allocations.filter(
                                                            (_, position) => position !== index,
                                                        ),
                                                    )
                                                }>
                                                Retirer
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        disabled={
                                            busy
                                            || used >= row.amount
                                            || !eligible.some(
                                                target =>
                                                    !proposal.allocations.some(item => item.target === target.key),
                                            )
                                        }
                                        onClick={() => {
                                            const target = eligible.find(
                                                target =>
                                                    !proposal.allocations.some(item => item.target === target.key),
                                            );
                                            if (!target) return;
                                            updateProposal(proposal.row, [
                                                ...proposal.allocations,
                                                {
                                                    target: target.key,
                                                    amount: Math.min(row.amount - used, target.remaining),
                                                },
                                            ]);
                                        }}>
                                        Ajouter une répartition
                                    </Button>
                                </section>
                            );
                        })}
                    </div>
                    <div className="bg-muted/30 flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-muted-foreground text-xs leading-5">
                            Vérifiez les dates, montants et doublons. La confirmation est nécessaire pour enregistrer
                            les données.
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
                </Card>
            )}
        </Stack>
    );
}
