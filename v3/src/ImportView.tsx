import { useQueryClient } from '@tanstack/react-query';
import { hc } from 'hono/client';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import { useState } from 'react';

import type { AppType } from '../server/app';
import { MAX_CSV_BYTES, type ImportError, type ImportKind, type ImportRow } from '../server/import-csv';
import { displayDate } from '../shared/schedule';

import { PageHeading } from './components/PageHeading';
import { Alert, Badge, Button, Card, FileInput, Select, Stack, Table, Text } from './components/ui/primitives';

type Preview = {
    rows: ImportRow[];
    errors: ImportError[];
    duplicates: { row: number; marker: string }[];
    imported: boolean;
};
const api = hc<AppType>('/');
const money = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);

export function ImportView() {
    const client = useQueryClient();
    const [kind, setKind] = useState<ImportKind>('charges');
    const [file, setFile] = useState<File | null>(null);
    const [csv, setCsv] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const activeStep = preview ? 2 : file ? 1 : 0;

    async function send(content: string, commit: boolean, approvedDuplicates: string[]) {
        const res = await api.api.import.$post({ json: { kind, csv: content, commit, approvedDuplicates } });
        if (!res.ok) {
            const body: unknown = await res.json();
            throw new Error(
                typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
                    ? body.error
                    : 'La requête d’import a échoué.',
            );
        }
        return res.json() as Promise<Preview>;
    }

    async function inspect() {
        if (!file) return;
        setBusy(true);
        setError('');
        setNotice('');
        setPreview(null);
        try {
            if (file.size > MAX_CSV_BYTES) throw new Error('Fichier trop volumineux (maximum 1 Mo).');
            const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
            const result = await send(content, false, []);
            setCsv(content);
            setPreview(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Impossible de lire le fichier.');
        } finally {
            setBusy(false);
        }
    }

    async function commit() {
        if (!preview || preview.errors.length) return;
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
                setNotice('Les doublons ou les données ont changé. Vérifiez le nouvel aperçu avant de confirmer.');
                return;
            }
            setNotice(`${result.rows.length} mouvement(s) importé(s).`);
            setPreview(null);
            setCsv('');
            setFile(null);
            await Promise.all([
                client.invalidateQueries({ queryKey: ['charges'] }),
                client.invalidateQueries({ queryKey: ['payments'] }),
                client.invalidateQueries({ queryKey: ['settings'] }),
            ]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Import impossible.');
        } finally {
            setBusy(false);
        }
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
                <div className="grid gap-4 md:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1.3fr)]">
                    <Select
                        label="Contenu du fichier"
                        value={kind}
                        disabled={busy}
                        allowDeselect={false}
                        data={[
                            { value: 'charges', label: 'Charges' },
                            { value: 'payments', label: 'Paiements' },
                            { value: 'solde', label: 'Solde (charges et paiements)' },
                        ]}
                        onChange={value => {
                            if (value === 'charges' || value === 'payments' || value === 'solde') setKind(value);
                            setPreview(null);
                            setCsv('');
                            setNotice('');
                            setError('');
                        }}
                    />
                    <FileInput
                        label="Fichier CSV UTF-8"
                        accept=".csv,text/csv"
                        value={file}
                        disabled={busy}
                        onChange={value => {
                            setFile(value);
                            setPreview(null);
                            setCsv('');
                            setNotice('');
                            setError('');
                        }}
                    />
                </div>
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
                        L’analyse ne modifie aucune donnée. Les paiements importés restent non affectés jusqu’à leur
                        répartition.
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
                            </Alert>
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
                                            <Table.Th>Type</Table.Th>
                                            <Table.Th className="text-end">Montant</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {preview.rows.map(row => (
                                            <Table.Tr key={row.row}>
                                                <Table.Td>{row.row}</Table.Td>
                                                <Table.Td>{displayDate(row.date)}</Table.Td>
                                                <Table.Td>{row.kind === 'charge' ? 'Charge' : 'Paiement'}</Table.Td>
                                                <Table.Td className="max-w-72 truncate">
                                                    {row.kind === 'charge' ? row.title : (row.label ?? '—')}
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
                    </div>
                    <div className="bg-muted/30 flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-muted-foreground text-xs leading-5">
                            Vérifiez les dates, montants et doublons. La confirmation est nécessaire pour enregistrer
                            les données.
                        </p>
                        <Button
                            onClick={commit}
                            disabled={preview.errors.length > 0 || !preview.rows.length}
                            loading={busy}>
                            {preview.duplicates.length ? 'Confirmer avec les doublons' : 'Confirmer l’import'}
                        </Button>
                    </div>
                </Card>
            )}
        </Stack>
    );
}
