import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAuthClient } from 'better-auth/react';
import { hc } from 'hono/client';
import { CreditCard, Home, List, Menu, Moon, Receipt, Settings, Sun, Upload, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router';
import {
    CartesianGrid,
    Line,
    LineChart as RechartsLineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import type { AppType } from '../server/app';
import { addMonths, displayDate, makeSchedule, remainingInstallments } from '../shared/schedule';

import {
    Alert,
    Autocomplete,
    Badge,
    Button,
    Card,
    Group,
    Progress,
    PasswordInput,
    Select,
    Stack,
    Table,
    Text,
    TextInput,
    Title,
} from './components/ui/primitives';
import { useFormState } from './lib/use-form-state';

const auth = createAuthClient({ baseURL: window.location.origin });
const api = hc<AppType>('/');
const today = () => new Date().toLocaleDateString('en-CA');
const money = (cents: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const ImportView = lazy(() => import('./ImportView').then(module => ({ default: module.ImportView })));
const SettingsView = lazy(() => import('./SettingsView').then(module => ({ default: module.SettingsView })));

function FrenchDateInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (date: string) => void;
}) {
    const [text, setText] = useState(displayDate(value));
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (value) {
            setText(displayDate(value));
            input.current?.setCustomValidity('');
        }
    }, [value]);
    return (
        <TextInput
            ref={input}
            label={label}
            required
            placeholder="jj/mm/aaaa"
            value={text}
            onChange={event => {
                const next = event.currentTarget.value;
                setText(next);
                const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(next);
                const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
                try {
                    if (!iso || addMonths(iso, 0) !== iso) throw new Error('Date invalide');
                    event.currentTarget.setCustomValidity('');
                    onChange(iso);
                } catch {
                    event.currentTarget.setCustomValidity('Saisissez une date valide au format jj/mm/aaaa.');
                    onChange('');
                }
            }}
        />
    );
}
function cents(value: string) {
    const match = /^(\d{1,6})(?:[,.](\d{1,2}))?$/.exec(value.trim());
    if (!match) throw new Error('Saisissez un montant valide en euros (deux décimales au maximum).');
    const result = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    if (result < 1) throw new Error('Le montant doit être supérieur à zéro.');
    return result;
}

async function response<T>(res: Response): Promise<T> {
    const body: unknown = await res.json();
    if (!res.ok) {
        const message =
            typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
                ? body.error
                : 'La requête a échoué.';
        throw new Error(message);
    }
    return body as T;
}

async function getCharges() {
    const res = await api.api.charges.$get();
    if (!res.ok) throw new Error('Impossible de charger les charges.');
    return res.json();
}
async function getPayments() {
    const res = await api.api.payments.$get();
    if (!res.ok) throw new Error('Impossible de charger les paiements.');
    return res.json();
}
async function getSettings() {
    const res = await api.api.settings.$get();
    if (!res.ok) throw new Error('Impossible de charger les paramètres.');
    return res.json();
}
type Charge = Awaited<ReturnType<typeof getCharges>>[number];
type Payment = Awaited<ReturnType<typeof getPayments>>[number];
export type Settings = Awaited<ReturnType<typeof getSettings>>;

function Login() {
    const [signup, setSignup] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const form = useFormState({ name: '', email: '', password: '' });
    async function submit(values: typeof form.values) {
        setError('');
        setLoading(true);
        try {
            const result = signup
                ? await auth.signUp.email(values)
                : await auth.signIn.email({ email: values.email, password: values.password });
            if (result.error) setError(result.error.message ?? 'Connexion impossible.');
        } catch {
            setError('Impossible de contacter le serveur.');
        } finally {
            setLoading(false);
        }
    }
    return (
        <main className="grid min-h-screen place-items-center p-4">
            <Card withBorder radius="lg" p="xl" className="w-full max-w-md">
                <Stack>
                    <Title order={1}>ChargesTBA</Title>
                    <Text c="dimmed">Suivez vos charges et vos paiements en toute simplicité.</Text>
                    <Title order={2} size="h3">
                        {signup ? 'Créer un compte' : 'Connexion'}
                    </Title>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    <form onSubmit={form.onSubmit(submit)}>
                        <Stack>
                            {signup && <TextInput label="Nom" required {...form.getInputProps('name')} />}
                            <TextInput
                                label="Adresse e-mail"
                                type="email"
                                required
                                autoComplete="email"
                                {...form.getInputProps('email')}
                            />
                            <PasswordInput
                                label="Mot de passe"
                                required
                                minLength={8}
                                autoComplete={signup ? 'new-password' : 'current-password'}
                                {...form.getInputProps('password')}
                            />
                            <Button type="submit" loading={loading}>
                                {signup ? 'Créer mon compte' : 'Se connecter'}
                            </Button>
                        </Stack>
                    </form>
                    <Button
                        variant="link"
                        className="h-auto px-0"
                        onClick={() => {
                            setSignup(!signup);
                            setError('');
                        }}>
                        {signup ? 'J’ai déjà un compte' : 'Créer un compte'}
                    </Button>
                </Stack>
            </Card>
        </main>
    );
}

function ChargeForm({ onDone, charge, settings }: { onDone: () => void; charge?: Charge; settings: Settings }) {
    const client = useQueryClient();
    const [error, setError] = useState('');
    const form = useFormState(
        charge
            ? {
                  title: charge.title,
                  category: charge.category,
                  date: charge.date,
                  amount: (charge.amount / 100).toFixed(2),
              }
            : { title: '', category: '', date: today(), amount: '' },
    );
    const [mode, setMode] = useState(charge ? 'custom' : 'once');
    const [schedule, setSchedule] = useState(
        charge?.schedule.map(item => ({ date: item.date, amount: (item.amount / 100).toFixed(2) })) ?? [
            { date: today(), amount: '' },
        ],
    );
    const selectedTemplate = settings.templates.find(item => item.id === mode);
    let preview: { date: string; amount: number }[] = [];
    let previewError = '';
    if (selectedTemplate && form.values.date && form.values.amount) {
        try {
            preview = makeSchedule(form.values.date, cents(form.values.amount), selectedTemplate.rules);
        } catch (e) {
            previewError = e instanceof Error ? e.message : 'Impossible de calculer les échéances.';
        }
    }
    const mutation = useMutation({
        mutationFn: async (values: typeof form.values) => {
            const total = cents(values.amount);
            let items;
            if (mode === 'custom') items = schedule.map(item => ({ date: item.date, amount: cents(item.amount) }));
            else if (mode === 'once') items = [{ date: values.date, amount: total }];
            else {
                const template = settings.templates.find(item => item.id === mode);
                if (!template) throw new Error('Échéancier introuvable.');
                items = makeSchedule(values.date, total, template.rules);
            }
            if (items.reduce((sum, item) => sum + item.amount, 0) !== total)
                throw new Error('Le total des échéances doit correspondre au montant de la charge.');
            if (
                !settings.categories.some(
                    item => item.name.toLocaleLowerCase('fr-FR') === values.category.trim().toLocaleLowerCase('fr-FR'),
                )
            ) {
                await response(
                    await api.api.categories.$post({ json: { name: values.category, defaultScheduleId: null } }),
                );
                await client.invalidateQueries({ queryKey: ['settings'] });
            }
            const json = { ...values, amount: total, installments: items.length, schedule: items };
            return response(
                charge
                    ? await api.api.charges[':id'].$put({ param: { id: charge.id }, json })
                    : await api.api.charges.$post({ json }),
            );
        },
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ['charges'] });
            onDone();
        },
        onError: e => setError(e.message),
    });
    return (
        <Card withBorder radius="md" p="lg">
            <form onSubmit={form.onSubmit(values => mutation.mutate(values))}>
                <Stack>
                    <Title order={2} size="h3">
                        {charge ? 'Modifier la charge' : 'Nouvelle charge'}
                    </Title>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    <TextInput label="Libellé" required {...form.getInputProps('title')} />
                    <Autocomplete
                        label="Catégorie"
                        required
                        data={settings.categories.map(item => item.name)}
                        description="Choisissez une catégorie ou saisissez-en une nouvelle."
                        value={form.values.category}
                        onChange={value => {
                            form.setFieldValue('category', value);
                            const category = settings.categories.find(item => item.name === value);
                            if (category) setMode(category.defaultScheduleId ?? 'once');
                        }}
                    />
                    <FrenchDateInput
                        label="Date de la charge"
                        value={form.values.date}
                        onChange={value => form.setFieldValue('date', value)}
                    />
                    <TextInput
                        label="Montant en euros"
                        placeholder="300,00"
                        required
                        inputMode="decimal"
                        {...form.getInputProps('amount')}
                    />
                    <Select
                        label="Échéancier"
                        value={mode}
                        onChange={value => value && setMode(value)}
                        allowDeselect={false}
                        data={[
                            { value: 'once', label: 'Paiement unique à la date de la charge' },
                            ...settings.templates.map(item => ({ value: item.id, label: item.name })),
                            { value: 'custom', label: 'Échéancier personnalisé' },
                        ]}
                    />
                    {previewError && (
                        <Text size="sm" c="red">
                            {previewError}
                        </Text>
                    )}
                    {preview.length > 0 && (
                        <Stack gap="xs">
                            {preview.map((item, index) => (
                                <Text key={index} size="sm">
                                    {displayDate(item.date)} : {money(item.amount)}
                                </Text>
                            ))}
                            <Group>
                                <Button
                                    type="button"
                                    variant="light"
                                    onClick={() => {
                                        setSchedule(
                                            preview.map(item => ({
                                                date: item.date,
                                                amount: (item.amount / 100).toFixed(2),
                                            })),
                                        );
                                        setMode('custom');
                                    }}>
                                    Personnaliser ces échéances
                                </Button>
                            </Group>
                        </Stack>
                    )}
                    {mode === 'custom' && (
                        <>
                            {schedule.map((item, index) => (
                                <Group key={index} align="end">
                                    <FrenchDateInput
                                        label={`Échéance ${index + 1}`}
                                        value={item.date}
                                        onChange={value =>
                                            setSchedule(current =>
                                                current.map((row, i) => (i === index ? { ...row, date: value } : row)),
                                            )
                                        }
                                    />
                                    <TextInput
                                        label="Montant en euros"
                                        required
                                        inputMode="decimal"
                                        value={item.amount}
                                        onChange={event => {
                                            const amount = event.currentTarget.value;
                                            setSchedule(current =>
                                                current.map((row, i) => (i === index ? { ...row, amount } : row)),
                                            );
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="subtle"
                                        disabled={schedule.length === 1}
                                        onClick={() => setSchedule(current => current.filter((_, i) => i !== index))}>
                                        Supprimer
                                    </Button>
                                </Group>
                            ))}
                            <Button
                                type="button"
                                variant="light"
                                disabled={schedule.length >= 120}
                                onClick={() =>
                                    setSchedule(current => [...current, { date: form.values.date, amount: '' }])
                                }>
                                Ajouter une échéance
                            </Button>
                        </>
                    )}
                    <Group>
                        <Button type="submit" loading={mutation.isPending}>
                            Enregistrer
                        </Button>
                        <Button variant="subtle" onClick={onDone}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

function ChargesView({ charges, settings }: { charges: Charge[]; settings: Settings }) {
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<Charge | null>(null);
    return (
        <Stack>
            <Group justify="space-between">
                <Title order={1}>Charges</Title>
                <Button onClick={() => setAdding(true)}>Ajouter une charge</Button>
            </Group>
            {adding && <ChargeForm settings={settings} onDone={() => setAdding(false)} />}
            {editing && (
                <ChargeForm key={editing.id} charge={editing} settings={settings} onDone={() => setEditing(null)} />
            )}
            {charges.length === 0 && <Text c="dimmed">Aucune charge pour le moment.</Text>}
            {charges.map(charge => (
                <Card withBorder radius="md" p="lg" key={charge.id}>
                    <Group justify="space-between">
                        <div>
                            <Text fw={600}>{charge.title}</Text>
                            <Text c="dimmed" size="sm">
                                {charge.category} · {displayDate(charge.date)}
                            </Text>
                        </div>
                        <Badge>{money(charge.amount - charge.paid)} à payer</Badge>
                    </Group>
                    <Progress
                        value={(charge.paid / charge.amount) * 100}
                        mt="md"
                        aria-label={`Avancement de ${charge.title}`}
                    />
                    <Text size="sm" c="dimmed" mt="xs">
                        {money(charge.paid)} / {money(charge.amount)} · {charge.installments} échéance(s)
                    </Text>
                    {charge.schedule.map((item, index) => (
                        <Text key={index} size="sm" c="dimmed">
                            {displayDate(item.date)} : {money(item.amount)}
                        </Text>
                    ))}
                    <Button variant="subtle" size="xs" mt="xs" onClick={() => setEditing(charge)}>
                        Modifier
                    </Button>
                </Card>
            ))}
        </Stack>
    );
}

function PaymentForm({ charges, onDone }: { charges: Charge[]; onDone: () => void }) {
    const client = useQueryClient();
    const [error, setError] = useState('');
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const form = useFormState({ date: today(), category: 'Virement', amount: '' });
    const mutation = useMutation({
        mutationFn: async (values: typeof form.values) =>
            response(
                await api.api.payments.$post({
                    json: {
                        ...values,
                        amount: cents(values.amount),
                        allocations: Object.entries(amounts)
                            .filter(([, value]) => value.trim() !== '')
                            .map(([chargeId, value]) => ({ chargeId, amount: cents(value) })),
                    },
                }),
            ),
        onSuccess: async () => {
            await client.invalidateQueries();
            onDone();
        },
        onError: e => setError(e.message),
    });
    return (
        <Card withBorder radius="md" p="lg">
            <form onSubmit={form.onSubmit(values => mutation.mutate(values))}>
                <Stack>
                    <Title order={2} size="h3">
                        Nouveau paiement
                    </Title>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    <FrenchDateInput
                        label="Date"
                        value={form.values.date}
                        onChange={value => form.setFieldValue('date', value)}
                    />
                    <TextInput label="Moyen de paiement" required {...form.getInputProps('category')} />
                    <TextInput
                        label="Montant en euros"
                        placeholder="100,00"
                        inputMode="decimal"
                        required
                        {...form.getInputProps('amount')}
                    />
                    <Text fw={600}>Répartir sur les charges en cours</Text>
                    <Text size="sm" c="dimmed">
                        Indiquez les montants à affecter. Le reste est conservé comme crédit non affecté.
                    </Text>
                    {charges
                        .filter(charge => charge.paid < charge.amount)
                        .map(charge => {
                            const suggested =
                                remainingInstallments(charge.schedule, charge.paid).find(item => item.amount > 0)
                                    ?.amount ?? 0;
                            return (
                                <Group key={charge.id} align="end" wrap="nowrap">
                                    <TextInput
                                        style={{ flex: 1 }}
                                        label={`${charge.title} — reste ${money(charge.amount - charge.paid)}`}
                                        value={amounts[charge.id] ?? ''}
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        onChange={event =>
                                            setAmounts({ ...amounts, [charge.id]: event.currentTarget.value })
                                        }
                                    />
                                    <Button
                                        variant="light"
                                        onClick={() =>
                                            setAmounts({ ...amounts, [charge.id]: (suggested / 100).toFixed(2) })
                                        }>
                                        Échéance {money(suggested)}
                                    </Button>
                                </Group>
                            );
                        })}
                    <Group>
                        <Button type="submit" loading={mutation.isPending}>
                            Enregistrer
                        </Button>
                        <Button variant="subtle" onClick={onDone}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

function PaymentsView({ charges, payments }: { charges: Charge[]; payments: Payment[] }) {
    const [adding, setAdding] = useState(false);
    const [creditPayment, setCreditPayment] = useState<Payment | null>(null);
    const [editing, setEditing] = useState<Payment | null>(null);
    return (
        <Stack>
            <Group justify="space-between">
                <Title order={1}>Paiements</Title>
                <Button onClick={() => setAdding(true)}>Ajouter un paiement</Button>
            </Group>
            {adding && <PaymentForm charges={charges} onDone={() => setAdding(false)} />}
            {creditPayment && (
                <CreditForm charges={charges} payment={creditPayment} onDone={() => setCreditPayment(null)} />
            )}
            {editing && <PaymentEdit key={editing.id} payment={editing} onDone={() => setEditing(null)} />}
            {payments.length === 0 ? (
                <Text c="dimmed">Aucun paiement pour le moment.</Text>
            ) : (
                <Table.ScrollContainer minWidth={600}>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Date</Table.Th>
                                <Table.Th>Moyen</Table.Th>
                                <Table.Th>Libellé</Table.Th>
                                <Table.Th>Montant</Table.Th>
                                <Table.Th>Non affecté</Table.Th>
                                <Table.Th>Action</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {payments.map(p => (
                                <Table.Tr key={p.id}>
                                    <Table.Td>{displayDate(p.date)}</Table.Td>
                                    <Table.Td>{p.category}</Table.Td>
                                    <Table.Td>{p.label || '—'}</Table.Td>
                                    <Table.Td>{money(p.amount)}</Table.Td>
                                    <Table.Td>{money(p.amount - p.allocated)}</Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            {p.amount > p.allocated && (
                                                <Button size="xs" variant="light" onClick={() => setCreditPayment(p)}>
                                                    Utiliser le crédit
                                                </Button>
                                            )}
                                            <Button size="xs" variant="subtle" onClick={() => setEditing(p)}>
                                                Modifier
                                            </Button>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
            )}
        </Stack>
    );
}

function PaymentEdit({ payment, onDone }: { payment: Payment; onDone: () => void }) {
    const client = useQueryClient();
    const [error, setError] = useState('');
    const form = useFormState({
        date: payment.date,
        category: payment.category,
        label: payment.label ?? '',
        amount: (payment.amount / 100).toFixed(2),
    });
    const mutation = useMutation({
        mutationFn: async (values: typeof form.values) =>
            response(
                await api.api.payments[':id'].$put({
                    param: { id: payment.id },
                    json: { ...values, amount: cents(values.amount) },
                }),
            ),
        onSuccess: async () => {
            await client.invalidateQueries();
            onDone();
        },
        onError: e => setError(e.message),
    });
    return (
        <Card withBorder radius="md" p="lg">
            <form onSubmit={form.onSubmit(values => mutation.mutate(values))}>
                <Stack>
                    <Title order={2} size="h3">
                        Modifier le paiement
                    </Title>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    <FrenchDateInput
                        label="Date"
                        value={form.values.date}
                        onChange={value => form.setFieldValue('date', value)}
                    />
                    <TextInput label="Moyen de paiement" required {...form.getInputProps('category')} />
                    <TextInput label="Libellé (facultatif)" maxLength={120} {...form.getInputProps('label')} />
                    <TextInput
                        label="Montant en euros"
                        inputMode="decimal"
                        required
                        {...form.getInputProps('amount')}
                    />
                    <Text c="dimmed" size="sm">
                        Déjà affecté : {money(payment.allocated)}. Les affectations existantes sont conservées.
                    </Text>
                    <Group>
                        <Button type="submit" loading={mutation.isPending}>
                            Enregistrer
                        </Button>
                        <Button variant="subtle" onClick={onDone}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

function CreditForm({ charges, payment, onDone }: { charges: Charge[]; payment: Payment; onDone: () => void }) {
    const client = useQueryClient();
    const [error, setError] = useState('');
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const mutation = useMutation({
        mutationFn: async () =>
            response(
                await api.api.payments[':id'].allocations.$post({
                    param: { id: payment.id },
                    json: {
                        allocations: Object.entries(amounts)
                            .filter(([, value]) => value.trim() !== '')
                            .map(([chargeId, value]) => ({ chargeId, amount: cents(value) })),
                    },
                }),
            ),
        onSuccess: async () => {
            await client.invalidateQueries();
            onDone();
        },
        onError: e => setError(e.message),
    });
    return (
        <Card withBorder radius="md" p="lg">
            <form
                onSubmit={event => {
                    event.preventDefault();
                    mutation.mutate();
                }}>
                <Stack>
                    <Title order={2} size="h3">
                        Utiliser le crédit de {money(payment.amount - payment.allocated)}
                    </Title>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    {charges
                        .filter(charge => charge.paid < charge.amount)
                        .map(charge => (
                            <TextInput
                                key={charge.id}
                                label={`${charge.title} — reste ${money(charge.amount - charge.paid)}`}
                                inputMode="decimal"
                                value={amounts[charge.id] ?? ''}
                                onChange={event => setAmounts({ ...amounts, [charge.id]: event.currentTarget.value })}
                            />
                        ))}
                    <Group>
                        <Button type="submit" loading={mutation.isPending}>
                            Affecter
                        </Button>
                        <Button variant="subtle" onClick={onDone}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

function Overview({ charges, payments, ledger = false }: { charges: Charge[]; payments: Payment[]; ledger?: boolean }) {
    const total = charges.reduce((sum, c) => sum + c.amount, 0);
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    const credit = payments.reduce((sum, p) => sum + p.amount - p.allocated, 0);
    const movements = [
        ...charges.map(c => ({ id: c.id, date: c.date, label: c.title, amount: -c.amount })),
        ...payments.map(p => ({ id: p.id, date: p.date, label: p.label || p.category, amount: p.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let running = 0;
    const rows = movements.map(m => ({ ...m, balance: (running += m.amount) }));
    const overdue = charges.reduce((sum, charge) => {
        return (
            sum
            + remainingInstallments(charge.schedule, charge.paid).reduce(
                (late, item) => late + (item.date < today() ? item.amount : 0),
                0,
            )
        );
    }, 0);
    if (ledger)
        return (
            <Stack>
                <Title order={1}>Mouvements</Title>
                <Text c="dimmed">Solde = paiements moins charges.</Text>
                <Table.ScrollContainer minWidth={550}>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Date</Table.Th>
                                <Table.Th>Libellé</Table.Th>
                                <Table.Th>Mouvement</Table.Th>
                                <Table.Th>Solde</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.map(row => (
                                <Table.Tr key={row.id}>
                                    <Table.Td>{displayDate(row.date)}</Table.Td>
                                    <Table.Td>{row.label}</Table.Td>
                                    <Table.Td>{money(row.amount)}</Table.Td>
                                    <Table.Td>{money(row.balance)}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
                <Text fw={600}>Solde total : {money(paid - total)}</Text>
            </Stack>
        );
    return (
        <Stack>
            <Title order={1}>Tableau de bord</Title>
            <Text c="dimmed">Une vue claire de vos charges et de vos paiements.</Text>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    ['Solde', paid - total],
                    ['Charges restantes', charges.reduce((sum, c) => sum + c.amount - c.paid, 0)],
                    ['Crédit non affecté', credit],
                    ['Échéances en retard', overdue],
                ].map(([label, value]) => (
                    <Card key={String(label)} withBorder radius="md" p="lg">
                        <Text c="dimmed" size="sm">
                            {label}
                        </Text>
                        <Title order={2}>{money(Number(value))}</Title>
                    </Card>
                ))}
            </div>
            {rows.length > 0 && (
                <Card withBorder radius="md" p="lg">
                    <Title order={2} size="h3" mb="lg">
                        Évolution du solde
                    </Title>
                    <div role="img" aria-label="Graphique de l’évolution du solde en euros">
                        <ResponsiveContainer width="100%" height={240}>
                            <RechartsLineChart
                                accessibilityLayer
                                data={rows.map(row => ({ date: displayDate(row.date), solde: row.balance / 100 }))}
                                margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                                <YAxis
                                    width={88}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={value => money(Number(value) * 100)}
                                />
                                <Tooltip formatter={value => [money(Number(value) * 100), 'Solde']} />
                                <Line
                                    dataKey="solde"
                                    type="linear"
                                    stroke="var(--primary)"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            </RechartsLineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
            <Text size="sm" c="dimmed">
                Les retards sont calculés selon les échéances enregistrées.
            </Text>
        </Stack>
    );
}

export function App() {
    const session = auth.useSession();
    const location = useLocation();
    const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() =>
        document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    );
    const [opened, setOpened] = useState(false);
    const client = useQueryClient();
    useEffect(() => {
        document.documentElement.classList.toggle('dark', colorScheme === 'dark');
        window.localStorage.setItem('charges-tba-color-scheme', colorScheme);
    }, [colorScheme]);
    useEffect(() => {
        if (!opened) return;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpened(false);
        }
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [opened]);
    const charges = useQuery({
        queryKey: ['charges', session.data?.user.id],
        queryFn: getCharges,
        enabled: !!session.data,
    });
    const payments = useQuery({
        queryKey: ['payments', session.data?.user.id],
        queryFn: getPayments,
        enabled: !!session.data,
    });
    const settings = useQuery({
        queryKey: ['settings', session.data?.user.id],
        queryFn: getSettings,
        enabled: !!session.data,
    });
    async function signOut(event: FormEvent) {
        event.preventDefault();
        const result = await auth.signOut();
        if (result.error) {
            window.alert('Déconnexion impossible.');
            return;
        }
        client.clear();
    }
    if (session.isPending) return <Text p="xl">Chargement…</Text>;
    if (session.error)
        return <Alert color="red">Impossible de vérifier la session. Vérifiez que le serveur fonctionne.</Alert>;
    if (!session.data) return <Login />;
    const items = [
        { path: '/', label: 'Tableau de bord', icon: Home },
        { path: '/charges', label: 'Charges', icon: Receipt },
        { path: '/payments', label: 'Paiements', icon: CreditCard },
        { path: '/ledger', label: 'Mouvements', icon: List },
        { path: '/settings', label: 'Paramètres', icon: Settings },
        { path: '/import', label: 'Importer', icon: Upload },
    ];
    return (
        <div className="bg-background min-h-screen md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
            <header className="bg-card/95 sticky top-0 z-40 flex min-h-16 items-center justify-between border-b px-4 backdrop-blur md:col-span-2 md:px-6">
                <div className="flex items-center gap-3">
                    <Button
                        variant="subtle"
                        size="icon"
                        className="md:hidden"
                        aria-label={opened ? 'Fermer le menu' : 'Ouvrir le menu'}
                        aria-expanded={opened}
                        onClick={() => setOpened(value => !value)}>
                        {opened ? <X /> : <Menu />}
                    </Button>
                    <span className="font-semibold tracking-tight">ChargesTBA</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="subtle"
                        size="icon"
                        aria-label={colorScheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                        title={colorScheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                        onClick={() => setColorScheme(value => (value === 'dark' ? 'light' : 'dark'))}>
                        {colorScheme === 'dark' ? <Sun /> : <Moon />}
                    </Button>
                    <form onSubmit={signOut}>
                        <Button type="submit" variant="subtle">
                            Déconnexion
                        </Button>
                    </form>
                </div>
            </header>
            {opened && (
                <button
                    type="button"
                    aria-label="Fermer le menu"
                    className="fixed inset-0 z-30 bg-black/40 md:hidden"
                    onClick={() => setOpened(false)}
                />
            )}
            <aside
                className={`${opened ? 'block' : 'hidden'} bg-card fixed top-16 left-0 z-40 h-[calc(100dvh-4rem)] w-60 overflow-y-auto border-r p-3 md:sticky md:top-16 md:row-start-2 md:block md:h-[calc(100vh-4rem)]`}>
                <nav aria-label="Navigation principale" className="grid gap-1">
                    {items.map(({ path, label, icon: Icon }) => (
                        <Link
                            key={path}
                            to={path}
                            onClick={() => setOpened(false)}
                            aria-current={location.pathname === path ? 'page' : undefined}
                            className={`hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${location.pathname === path ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
                            <Icon className="size-4" aria-hidden="true" />
                            {label}
                        </Link>
                    ))}
                </nav>
            </aside>
            <main className="min-w-0 p-4 sm:p-6 md:col-start-2 md:row-start-2 lg:p-8">
                <div className="mx-auto w-full max-w-6xl">
                    {charges.isError || payments.isError || settings.isError ? (
                        <Alert color="red" role="alert">
                            Impossible de charger les données.
                        </Alert>
                    ) : !charges.data || !payments.data || !settings.data ? (
                        <Text>Chargement…</Text>
                    ) : (
                        <Suspense fallback={<Text>Chargement…</Text>}>
                            <Routes>
                                <Route
                                    path="/"
                                    element={<Overview charges={charges.data} payments={payments.data} />}
                                />
                                <Route
                                    path="/charges"
                                    element={<ChargesView charges={charges.data} settings={settings.data} />}
                                />
                                <Route path="/settings" element={<SettingsView settings={settings.data} />} />
                                <Route
                                    path="/payments"
                                    element={<PaymentsView charges={charges.data} payments={payments.data} />}
                                />
                                <Route
                                    path="/ledger"
                                    element={<Overview charges={charges.data} payments={payments.data} ledger />}
                                />
                                <Route path="/import" element={<ImportView />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Suspense>
                    )}
                </div>
            </main>
        </div>
    );
}
