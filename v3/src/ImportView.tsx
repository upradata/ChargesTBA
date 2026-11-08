import { Alert, Button, FileInput, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { hc } from 'hono/client';
import { useState } from 'react';

import type { AppType } from '../server/app';
import { MAX_CSV_BYTES, type ImportError, type ImportKind, type ImportRow } from '../server/import-csv';
import { displayDate } from '../shared/schedule';

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
        <Stack>
            <Title order={1}>Importer un CSV</Title>
            <Text c="dimmed">
                Les paiements importés restent non affectés. Vérifiez les données avant confirmation.
            </Text>
            <Select
                label="Type de fichier"
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
            <Group>
                <Button onClick={inspect} disabled={!file} loading={busy}>
                    Analyser le fichier
                </Button>
            </Group>
            {error && (
                <Alert color="red" role="alert">
                    {error}
                </Alert>
            )}
            {notice && <Alert role="status">{notice}</Alert>}
            {preview && (
                <>
                    {preview.errors.length > 0 && (
                        <Alert color="red" title="Import impossible" role="alert">
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
                            {Array.from(new Set(preview.duplicates.map(item => item.row))).join(', ')}. La confirmation
                            importera aussi ces lignes.
                        </Alert>
                    )}
                    <Title order={2} size="h3">
                        Aperçu ({preview.rows.length})
                    </Title>
                    <Table.ScrollContainer minWidth={600}>
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Ligne</Table.Th>
                                    <Table.Th>Date</Table.Th>
                                    <Table.Th>Nature</Table.Th>
                                    <Table.Th>Libellé</Table.Th>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th>Montant</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {preview.rows.map(row => (
                                    <Table.Tr key={row.row}>
                                        <Table.Td>{row.row}</Table.Td>
                                        <Table.Td>{displayDate(row.date)}</Table.Td>
                                        <Table.Td>{row.kind === 'charge' ? 'Charge' : 'Paiement'}</Table.Td>
                                        <Table.Td>{row.kind === 'charge' ? row.title : (row.label ?? '—')}</Table.Td>
                                        <Table.Td>{row.category}</Table.Td>
                                        <Table.Td>{money(row.amount)}</Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                    <Group>
                        <Button
                            onClick={commit}
                            disabled={preview.errors.length > 0 || !preview.rows.length}
                            loading={busy}>
                            {preview.duplicates.length ? 'Confirmer l’import avec doublons' : 'Confirmer l’import'}
                        </Button>
                    </Group>
                </>
            )}
        </Stack>
    );
}
