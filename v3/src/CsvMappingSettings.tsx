import { useQueryClient } from '@tanstack/react-query';
import { hc } from 'hono/client';
import { useState, type FormEvent } from 'react';

import type { AppType } from '../server/app';

import type { Settings } from './App';
import { Alert, Button, Card, Group, Select, Stack, TextInput, Title } from './components/ui/primitives';

const api = hc<AppType>('/');

async function check(response: Response) {
    if (response.ok) return;
    const body: unknown = await response.json();
    throw new Error(
        typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'La requête a échoué.',
    );
}

function PaymentTypeEditor({ item, done }: { item?: Settings['paymentTypes'][number]; done: () => void }) {
    const [name, setName] = useState(item?.name ?? '');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    async function submit(event: FormEvent) {
        event.preventDefault();
        setPending(true);
        setError('');
        try {
            await check(
                item
                    ? await api.api['payment-types'][':id'].$put({ param: { id: item.id }, json: { name } })
                    : await api.api['payment-types'].$post({ json: { name } }),
            );
            done();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
        } finally {
            setPending(false);
        }
    }
    return (
        <Card withBorder>
            <form onSubmit={submit}>
                <Stack>
                    <Title order={3}>{item ? 'Modifier le type de paiement' : 'Nouveau type de paiement'}</Title>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    <TextInput
                        label="Nom"
                        required
                        maxLength={80}
                        value={name}
                        onChange={event => setName(event.currentTarget.value)}
                    />
                    <Group>
                        <Button type="submit" loading={pending}>
                            Enregistrer
                        </Button>
                        <Button type="button" variant="subtle" onClick={done}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

function RuleEditor({
    item,
    settings,
    done,
}: {
    item?: Settings['mappingRules'][number];
    settings: Settings;
    done: () => void;
}) {
    const [pattern, setPattern] = useState(item?.pattern ?? '');
    const [targetKind, setTargetKind] = useState<'charge' | 'payment'>(item?.paymentTypeId ? 'payment' : 'charge');
    const [targetId, setTargetId] = useState<string | null>(item?.categoryId ?? item?.paymentTypeId ?? null);
    const [ignoreCase, setIgnoreCase] = useState(item?.ignoreCase ?? true);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!targetId) {
            setError('Choisissez une catégorie.');
            return;
        }
        setPending(true);
        setError('');
        try {
            const json = { pattern, ignoreCase, targetKind, targetId };
            await check(
                item
                    ? await api.api['csv-rules'][':id'].$put({ param: { id: item.id }, json })
                    : await api.api['csv-rules'].$post({ json }),
            );
            done();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
        } finally {
            setPending(false);
        }
    }
    return (
        <Card withBorder>
            <form onSubmit={submit}>
                <Stack>
                    <Title order={3}>{item ? 'Modifier la règle CSV' : 'Nouvelle règle CSV'}</Title>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    <TextInput
                        label="Expression régulière (sans /)"
                        required
                        maxLength={120}
                        value={pattern}
                        onChange={event => setPattern(event.currentTarget.value)}
                    />
                    <Select
                        label="Type de mouvement"
                        value={targetKind}
                        data={[
                            { value: 'charge', label: 'Charge ou remboursement' },
                            { value: 'payment', label: 'Paiement' },
                        ]}
                        onChange={value => {
                            if (value === 'charge' || value === 'payment') {
                                setTargetKind(value);
                                setTargetId(null);
                            }
                        }}
                    />
                    <Select
                        label="Catégorie cible"
                        value={targetId}
                        placeholder="Choisir une catégorie"
                        data={(targetKind === 'charge' ? settings.categories : settings.paymentTypes).map(category => ({
                            value: category.id,
                            label: category.name,
                        }))}
                        onChange={setTargetId}
                    />
                    <Select
                        label="Casse"
                        value={ignoreCase ? 'ignore' : 'respect'}
                        data={[
                            { value: 'ignore', label: 'Ignorer la casse' },
                            { value: 'respect', label: 'Respecter la casse' },
                        ]}
                        onChange={value => setIgnoreCase(value === 'ignore')}
                    />
                    <Group>
                        <Button type="submit" loading={pending}>
                            Enregistrer
                        </Button>
                        <Button type="button" variant="subtle" onClick={done}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

export function CsvMappingSettings({ settings }: { settings: Settings }) {
    const client = useQueryClient();
    const [editingType, setEditingType] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    function done() {
        setEditingType(null);
        setEditingRule(null);
        void client.invalidateQueries({ queryKey: ['settings'] });
    }
    async function remove(kind: 'type' | 'rule', id: string) {
        if (
            !window.confirm(
                kind === 'type'
                    ? 'Supprimer ce type et ses règles CSV ? Les paiements existants ne seront pas modifiés.'
                    : 'Supprimer cette règle CSV ?',
            )
        )
            return;
        setBusy(true);
        setError('');
        try {
            await check(
                kind === 'type'
                    ? await api.api['payment-types'][':id'].$delete({ param: { id } })
                    : await api.api['csv-rules'][':id'].$delete({ param: { id } }),
            );
            done();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Suppression impossible.');
        } finally {
            setBusy(false);
        }
    }
    async function move(index: number, offset: number) {
        const ids = settings.mappingRules.map(rule => rule.id);
        const other = index + offset;
        if (other < 0 || other >= ids.length) return;
        [ids[index], ids[other]] = [ids[other], ids[index]];
        setBusy(true);
        setError('');
        try {
            await check(await api.api['csv-rules'].order.$put({ json: { ids } }));
            await client.invalidateQueries({ queryKey: ['settings'] });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Réorganisation impossible.');
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="grid items-start gap-6 xl:grid-cols-2">
            {error && (
                <Alert color="red" role="alert">
                    {error}
                </Alert>
            )}
            <section className="space-y-4" aria-labelledby="payment-types-heading">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="payment-types-heading" className="font-semibold">
                        Types de paiement
                    </h2>
                    <Button size="sm" variant="outline" onClick={() => setEditingType('new')}>
                        Ajouter
                    </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                    Les modifications ne changent pas les paiements déjà enregistrés.
                </p>
                {editingType && (
                    <PaymentTypeEditor
                        key={editingType}
                        item={settings.paymentTypes.find(item => item.id === editingType)}
                        done={done}
                    />
                )}
                <Card p="sm">
                    {settings.paymentTypes.length === 0 && (
                        <p className="text-muted-foreground p-3 text-sm">Aucun type de paiement.</p>
                    )}
                    <ul className="divide-y">
                        {settings.paymentTypes.map(item => (
                            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-2 py-3">
                                <span className="text-sm">{item.name}</span>
                                <Group gap="xs">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingType(item.id)}>
                                        Modifier
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="subtle"
                                        color="red"
                                        disabled={busy}
                                        onClick={() => void remove('type', item.id)}>
                                        Supprimer
                                    </Button>
                                </Group>
                            </li>
                        ))}
                    </ul>
                </Card>
            </section>
            <section className="space-y-4" aria-labelledby="csv-rules-heading">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="csv-rules-heading" className="font-semibold">
                        Correspondances CSV
                    </h2>
                    <Button size="sm" variant="outline" onClick={() => setEditingRule('new')}>
                        Ajouter
                    </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                    La première expression correspondante est utilisée. Vous pouvez modifier la catégorie dans l’aperçu.
                </p>
                {editingRule && (
                    <RuleEditor
                        key={editingRule}
                        item={settings.mappingRules.find(item => item.id === editingRule)}
                        settings={settings}
                        done={done}
                    />
                )}
                <Card p="sm">
                    {settings.mappingRules.length === 0 && (
                        <p className="text-muted-foreground p-3 text-sm">Aucune règle CSV.</p>
                    )}
                    <ol className="divide-y">
                        {settings.mappingRules.map((item, index) => {
                            const target = item.categoryId
                                ? settings.categories.find(category => category.id === item.categoryId)
                                : settings.paymentTypes.find(type => type.id === item.paymentTypeId);
                            return (
                                <li
                                    key={item.id}
                                    className="flex flex-wrap items-center justify-between gap-3 px-2 py-3">
                                    <div className="min-w-0">
                                        <code className="text-sm break-all">{item.pattern}</code>
                                        <p className="text-muted-foreground text-xs">
                                            {item.paymentTypeId ? 'Paiement' : 'Charge / remboursement'} ·{' '}
                                            {target?.name} · {item.ignoreCase ? 'casse ignorée' : 'casse respectée'}
                                        </p>
                                    </div>
                                    <Group gap="xs">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={busy || index === 0}
                                            aria-label={`Monter la règle ${item.pattern}`}
                                            onClick={() => void move(index, -1)}>
                                            ↑
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={busy || index === settings.mappingRules.length - 1}
                                            aria-label={`Descendre la règle ${item.pattern}`}
                                            onClick={() => void move(index, 1)}>
                                            ↓
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingRule(item.id)}>
                                            Modifier
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="subtle"
                                            color="red"
                                            disabled={busy}
                                            onClick={() => void remove('rule', item.id)}>
                                            Supprimer
                                        </Button>
                                    </Group>
                                </li>
                            );
                        })}
                    </ol>
                </Card>
            </section>
        </div>
    );
}
