import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAuthClient } from 'better-auth/react';
import { hc } from 'hono/client';
import {
    Building2,
    CalendarClock,
    CalendarDays,
    CircleDollarSign,
    Clock3,
    CreditCard,
    List,
    LogOut,
    Menu,
    Moon,
    PanelLeft,
    Plus,
    Receipt,
    Sun,
    Wallet,
    X,
    type LucideIcon,
} from 'lucide-react';
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
import { addMonths, displayDate, makeSchedule, remainingChargeAmount, remainingInstallments } from '../shared/schedule';

import { AppNavigation, navigationGroups } from './components/AppNavigation';
import { PageHeading } from './components/PageHeading';
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
const desktopNavigationQuery = '(min-width: 48rem)';

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
async function getRefunds() {
    const res = await api.api.refunds.$get();
    if (!res.ok) throw new Error('Impossible de charger les remboursements.');
    return res.json();
}
async function getSettings() {
    const res = await api.api.settings.$get();
    if (!res.ok) throw new Error('Impossible de charger les paramètres.');
    return res.json();
}
type Charge = Awaited<ReturnType<typeof getCharges>>[number];
type Payment = Awaited<ReturnType<typeof getPayments>>[number];
type Refund = Awaited<ReturnType<typeof getRefunds>>[number];
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
        <main className="bg-background grid min-h-screen place-items-center px-4 py-8 sm:px-6">
            <div className="bg-card grid w-full max-w-5xl overflow-hidden rounded-xl border lg:grid-cols-[1fr_0.9fr]">
                <section className="bg-muted/50 hidden flex-col justify-between border-e p-10 lg:flex">
                    <div className="flex items-center gap-3">
                        <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-lg">
                            <Building2 className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <p className="font-semibold tracking-tight">ChargesTBA</p>
                            <p className="text-muted-foreground text-xs">Suivi de copropriété</p>
                        </div>
                    </div>
                    <div className="max-w-md space-y-5">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            Vos comptes, en clair
                        </p>
                        <h1 className="text-3xl leading-tight font-semibold tracking-tight">
                            Une vue simple sur les charges et les paiements.
                        </h1>
                        <p className="text-muted-foreground leading-7">
                            Retrouvez les échéances, les règlements et le solde de votre copropriété au même endroit.
                        </p>
                        <div className="grid gap-3 pt-2 sm:grid-cols-3">
                            {[
                                ['01', 'Charges'],
                                ['02', 'Paiements'],
                                ['03', 'Solde'],
                            ].map(([number, label]) => (
                                <div key={label} className="border-t pt-3">
                                    <p className="text-muted-foreground font-mono text-xs">{number}</p>
                                    <p className="mt-1 text-sm font-medium">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="text-muted-foreground text-xs">Application locale · Prototype</p>
                </section>
                <section className="flex items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-sm">
                        <div className="mb-8 flex items-center gap-3 lg:hidden">
                            <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-lg">
                                <Building2 className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="font-semibold tracking-tight">ChargesTBA</p>
                                <p className="text-muted-foreground text-xs">Suivi de copropriété</p>
                            </div>
                        </div>
                        <div className="mb-6 space-y-2">
                            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                Espace personnel
                            </p>
                            <h2 className="text-2xl font-semibold tracking-tight">
                                {signup ? 'Créer un compte' : 'Bon retour'}
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                {signup
                                    ? 'Commencez à organiser votre suivi.'
                                    : 'Connectez-vous pour retrouver votre suivi.'}
                            </p>
                        </div>
                        {error && (
                            <Alert color="red" role="alert" className="mb-5">
                                {error}
                            </Alert>
                        )}
                        <form onSubmit={form.onSubmit(submit)}>
                            <Stack>
                                {signup && (
                                    <TextInput
                                        label="Nom"
                                        required
                                        autoComplete="name"
                                        {...form.getInputProps('name')}
                                    />
                                )}
                                <TextInput
                                    label="Adresse e-mail"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    {...form.getInputProps('email')}
                                />
                                <PasswordInput
                                    key={signup ? 'signup' : 'signin'}
                                    label="Mot de passe"
                                    required
                                    minLength={8}
                                    autoComplete={signup ? 'new-password' : 'current-password'}
                                    {...form.getInputProps('password')}
                                />
                                <Button type="submit" loading={loading} className="mt-2 w-full">
                                    {signup ? 'Créer mon compte' : 'Se connecter'}
                                </Button>
                            </Stack>
                        </form>
                        <div className="mt-5 border-t pt-4 text-center">
                            <Button
                                variant="link"
                                className="h-auto px-0"
                                onClick={() => {
                                    setSignup(!signup);
                                    setError('');
                                }}>
                                {signup ? 'J’ai déjà un compte' : 'Créer un compte'}
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
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
                    <div className="space-y-1">
                        <p className="text-primary text-xs font-semibold tracking-wider uppercase">
                            Détail de la charge
                        </p>
                        <Title order={2} size="h3">
                            {charge ? 'Modifier la charge' : 'Nouvelle charge'}
                        </Title>
                    </div>
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
        <Stack gap="lg">
            <PageHeading
                eyebrow="Suivi financier"
                title="Charges"
                description="Consultez les appels de fonds, leur échéancier et le montant restant à régler."
                actions={
                    <Button onClick={() => setAdding(true)}>
                        <Plus aria-hidden="true" /> Ajouter une charge
                    </Button>
                }
            />
            {adding && <ChargeForm settings={settings} onDone={() => setAdding(false)} />}
            {editing && (
                <ChargeForm key={editing.id} charge={editing} settings={settings} onDone={() => setEditing(null)} />
            )}
            {charges.length === 0 ? (
                <Card className="items-center py-12 text-center" p="lg">
                    <span className="bg-muted text-muted-foreground mb-4 grid size-12 place-items-center rounded-full">
                        <Receipt className="size-5" aria-hidden="true" />
                    </span>
                    <Title order={2} size="h3">
                        Aucune charge enregistrée
                    </Title>
                    <Text c="dimmed" size="sm" className="mt-2 max-w-md">
                        Ajoutez votre premier appel de fonds pour suivre son échéancier et les règlements associés.
                    </Text>
                    <Button className="mt-5" onClick={() => setAdding(true)}>
                        <Plus aria-hidden="true" /> Ajouter une charge
                    </Button>
                </Card>
            ) : (
                <Card p="sm" className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
                        <div>
                            <p className="text-sm font-semibold">Toutes les charges</p>
                            <p className="text-muted-foreground mt-1 text-xs">{charges.length} enregistrement(s)</p>
                        </div>
                        <span className="text-muted-foreground text-xs">Montants en euros</span>
                    </div>
                    <Table.ScrollContainer minWidth={760}>
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th className="ps-4">Charge</Table.Th>
                                    <Table.Th>Échéances</Table.Th>
                                    <Table.Th>Progression</Table.Th>
                                    <Table.Th className="text-end">Montant</Table.Th>
                                    <Table.Th className="text-end">Reste à payer</Table.Th>
                                    <Table.Th className="pe-4 text-end">Action</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {charges.map(charge => {
                                    const settled = charge.paid + charge.refunded;
                                    const remaining = remainingChargeAmount(
                                        charge.amount,
                                        charge.paid,
                                        charge.refunded,
                                    );
                                    const progress = (settled / charge.amount) * 100;
                                    return (
                                        <Table.Tr key={charge.id}>
                                            <Table.Td className="py-4 ps-4">
                                                <p className="max-w-64 truncate font-medium">{charge.title}</p>
                                                <p className="text-muted-foreground mt-1 text-xs">
                                                    {charge.category} · {displayDate(charge.date)}
                                                </p>
                                            </Table.Td>
                                            <Table.Td>{charge.installments} échéance(s)</Table.Td>
                                            <Table.Td className="min-w-36">
                                                <div className="flex items-center gap-2">
                                                    <Progress
                                                        value={progress}
                                                        aria-label={`Avancement de ${charge.title}`}
                                                        className="h-2"
                                                    />
                                                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                                                        {Math.round(progress)}%
                                                    </span>
                                                </div>
                                            </Table.Td>
                                            <Table.Td className="text-end font-mono tabular-nums">
                                                {money(charge.amount)}
                                            </Table.Td>
                                            <Table.Td className="text-end font-mono font-medium tabular-nums">
                                                {remaining > 0 ? (
                                                    money(remaining)
                                                ) : (
                                                    <Badge variant="secondary">Soldée</Badge>
                                                )}
                                            </Table.Td>
                                            <Table.Td className="pe-4 text-end">
                                                <Button size="sm" variant="outline" onClick={() => setEditing(charge)}>
                                                    Modifier
                                                </Button>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                </Card>
            )}
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
                    <div className="space-y-1">
                        <p className="text-primary text-xs font-semibold tracking-wider uppercase">Enregistrement</p>
                        <Title order={2} size="h3">
                            Nouveau paiement
                        </Title>
                    </div>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
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
                    </div>
                    <section className="space-y-3 border-t pt-5">
                        <div className="space-y-1">
                            <h3 className="font-semibold">Répartir sur les charges en cours</h3>
                            <p className="text-muted-foreground text-sm">
                                Indiquez les montants à affecter. Le reste est conservé comme crédit non affecté.
                            </p>
                        </div>
                        {charges.filter(
                            charge => remainingChargeAmount(charge.amount, charge.paid, charge.refunded) > 0,
                        ).length === 0 ? (
                            <p className="bg-muted/50 text-muted-foreground rounded-lg px-4 py-3 text-sm">
                                Aucune charge n’a de solde restant à régler.
                            </p>
                        ) : (
                            charges
                                .filter(
                                    charge => remainingChargeAmount(charge.amount, charge.paid, charge.refunded) > 0,
                                )
                                .map(charge => {
                                    const suggested =
                                        remainingInstallments(charge.schedule, charge.paid + charge.refunded).find(
                                            item => item.amount > 0,
                                        )?.amount ?? 0;
                                    return (
                                        <div
                                            key={charge.id}
                                            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                            <TextInput
                                                label={`${charge.title} — reste ${money(remainingChargeAmount(charge.amount, charge.paid, charge.refunded))}`}
                                                value={amounts[charge.id] ?? ''}
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                onChange={event =>
                                                    setAmounts({ ...amounts, [charge.id]: event.currentTarget.value })
                                                }
                                            />
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setAmounts({
                                                        ...amounts,
                                                        [charge.id]: (suggested / 100).toFixed(2),
                                                    })
                                                }>
                                                <CalendarClock aria-hidden="true" /> Échéance {money(suggested)}
                                            </Button>
                                        </div>
                                    );
                                })
                        )}
                    </section>
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
        <Stack gap="lg">
            <PageHeading
                eyebrow="Suivi financier"
                title="Paiements"
                description="Retrouvez les règlements enregistrés et utilisez le crédit disponible pour affecter les charges."
                actions={
                    <Button onClick={() => setAdding(true)}>
                        <Plus aria-hidden="true" /> Ajouter un paiement
                    </Button>
                }
            />
            {adding && <PaymentForm charges={charges} onDone={() => setAdding(false)} />}
            {creditPayment && (
                <CreditForm charges={charges} payment={creditPayment} onDone={() => setCreditPayment(null)} />
            )}
            {editing && <PaymentEdit key={editing.id} payment={editing} onDone={() => setEditing(null)} />}
            {payments.length === 0 ? (
                <Card className="items-center py-12 text-center" p="lg">
                    <span className="bg-muted text-muted-foreground mb-4 grid size-12 place-items-center rounded-full">
                        <CreditCard className="size-5" aria-hidden="true" />
                    </span>
                    <Title order={2} size="h3">
                        Aucun paiement enregistré
                    </Title>
                    <Text c="dimmed" size="sm" className="mt-2 max-w-md">
                        Enregistrez un règlement pour le répartir sur une ou plusieurs charges.
                    </Text>
                    <Button className="mt-5" onClick={() => setAdding(true)}>
                        <Plus aria-hidden="true" /> Ajouter un paiement
                    </Button>
                </Card>
            ) : (
                <Card p="sm" className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
                        <div>
                            <p className="text-sm font-semibold">Historique des paiements</p>
                            <p className="text-muted-foreground mt-1 text-xs">{payments.length} enregistrement(s)</p>
                        </div>
                        <span className="text-muted-foreground text-xs">Montants en euros</span>
                    </div>
                    <Table.ScrollContainer minWidth={760}>
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th className="ps-4">Date</Table.Th>
                                    <Table.Th>Moyen</Table.Th>
                                    <Table.Th>Libellé</Table.Th>
                                    <Table.Th className="text-end">Montant</Table.Th>
                                    <Table.Th className="text-end">Affecté</Table.Th>
                                    <Table.Th className="text-end">Crédit restant</Table.Th>
                                    <Table.Th className="pe-4 text-end">Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {payments.map(payment => {
                                    const available = payment.amount - payment.allocated;
                                    return (
                                        <Table.Tr key={payment.id}>
                                            <Table.Td className="py-4 ps-4">{displayDate(payment.date)}</Table.Td>
                                            <Table.Td>{payment.category}</Table.Td>
                                            <Table.Td className="max-w-56 truncate">{payment.label || '—'}</Table.Td>
                                            <Table.Td className="text-end font-mono tabular-nums">
                                                {money(payment.amount)}
                                            </Table.Td>
                                            <Table.Td className="text-end font-mono tabular-nums">
                                                {money(payment.allocated)}
                                            </Table.Td>
                                            <Table.Td className="text-end font-mono font-medium tabular-nums">
                                                {available > 0 ? (
                                                    money(available)
                                                ) : (
                                                    <Badge variant="secondary">Utilisé</Badge>
                                                )}
                                            </Table.Td>
                                            <Table.Td className="pe-4">
                                                <Group className="justify-end" gap="xs" wrap="nowrap">
                                                    {available > 0 && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setCreditPayment(payment)}>
                                                            Affecter
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditing(payment)}>
                                                        Modifier
                                                    </Button>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                </Card>
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
                    <div className="space-y-1">
                        <p className="text-primary text-xs font-semibold tracking-wider uppercase">Correction</p>
                        <Title order={2} size="h3">
                            Modifier le paiement
                        </Title>
                    </div>
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
                    <div className="space-y-1">
                        <p className="text-primary text-xs font-semibold tracking-wider uppercase">Affectation</p>
                        <Title order={2} size="h3">
                            Utiliser le crédit de {money(payment.amount - payment.allocated)}
                        </Title>
                    </div>
                    {error && (
                        <Alert color="red" role="alert">
                            {error}
                        </Alert>
                    )}
                    {charges
                        .filter(charge => remainingChargeAmount(charge.amount, charge.paid, charge.refunded) > 0)
                        .map(charge => (
                            <TextInput
                                key={charge.id}
                                label={`${charge.title} — reste ${money(remainingChargeAmount(charge.amount, charge.paid, charge.refunded))}`}
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

function MetricCard({
    label,
    value,
    detail,
    icon: Icon,
}: {
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
}) {
    return (
        <Card p="md" className="min-w-0 gap-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
                <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md">
                    <Icon className="size-4" aria-hidden="true" />
                </span>
            </div>
            <div>
                <p className="font-mono text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
                    {money(value)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
            </div>
        </Card>
    );
}

function Overview({
    charges,
    payments,
    refunds,
    ledger = false,
}: {
    charges: Charge[];
    payments: Payment[];
    refunds: Refund[];
    ledger?: boolean;
}) {
    const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const paymentCredit = payments.reduce((sum, payment) => sum + payment.amount - payment.allocated, 0);
    const refundTotal = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    const refundCredit = refunds.reduce((sum, refund) => sum + refund.unappliedAmount, 0);
    const credit = paymentCredit + refundCredit;
    const outstanding = charges.reduce(
        (sum, charge) => sum + remainingChargeAmount(charge.amount, charge.paid, charge.refunded),
        0,
    );
    const movements = [
        ...charges.map(charge => ({
            id: charge.id,
            date: charge.date,
            label: charge.title,
            kind: 'Charge',
            amount: -charge.amount,
        })),
        ...payments.map(payment => ({
            id: payment.id,
            date: payment.date,
            label: payment.label || payment.category,
            kind: 'Paiement',
            amount: payment.amount,
        })),
        ...refunds.map(refund => ({
            id: refund.id,
            date: refund.date,
            label: refund.title,
            kind: 'Remboursement',
            amount: refund.amount,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let running = 0;
    const rows = movements.map(movement => ({ ...movement, balance: (running += movement.amount) }));
    const recent = [...rows].reverse().slice(0, 5);
    const overdue = charges.reduce(
        (sum, charge) =>
            sum
            + remainingInstallments(charge.schedule, charge.paid + charge.refunded).reduce(
                (late, item) => late + (item.date < today() ? item.amount : 0),
                0,
            ),
        0,
    );
    const upcoming = charges
        .flatMap(charge =>
            remainingInstallments(charge.schedule, charge.paid + charge.refunded).map(item => ({
                id: `${charge.id}-${item.date}`,
                title: charge.title,
                date: item.date,
                amount: item.amount,
            })),
        )
        .filter(item => item.amount > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

    if (ledger)
        return (
            <Stack gap="lg">
                <PageHeading
                    eyebrow="Historique comptable"
                    title="Mouvements"
                    description="Un relevé chronologique des charges et des paiements, avec le solde cumulé."
                />
                <Card className="flex-row flex-wrap items-center justify-between gap-4" p="lg">
                    <div>
                        <p className="text-muted-foreground text-sm">Solde du compte</p>
                        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                            {money(paid - total + refundTotal)}
                        </p>
                    </div>
                    <p className="text-muted-foreground text-sm">Paiements + remboursements − charges</p>
                </Card>
                {rows.length === 0 ? (
                    <Card className="items-center py-12 text-center" p="lg">
                        <span className="bg-muted text-muted-foreground mb-4 grid size-12 place-items-center rounded-full">
                            <List className="size-5" aria-hidden="true" />
                        </span>
                        <Title order={2} size="h3">
                            Aucun mouvement pour le moment
                        </Title>
                        <Text c="dimmed" size="sm" className="mt-2">
                            Les charges et paiements apparaîtront ici.
                        </Text>
                    </Card>
                ) : (
                    <Card p="sm" className="overflow-hidden">
                        <Table.ScrollContainer minWidth={650}>
                            <Table>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th className="ps-4">Date</Table.Th>
                                        <Table.Th>Nature</Table.Th>
                                        <Table.Th>Libellé</Table.Th>
                                        <Table.Th className="text-end">Mouvement</Table.Th>
                                        <Table.Th className="pe-4 text-end">Solde cumulé</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {rows.map(row => (
                                        <Table.Tr key={`${row.kind}-${row.id}`}>
                                            <Table.Td className="py-4 ps-4">{displayDate(row.date)}</Table.Td>
                                            <Table.Td>
                                                <Badge variant={row.kind === 'Charge' ? 'outline' : 'secondary'}>
                                                    {row.kind}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td className="max-w-72 truncate">{row.label}</Table.Td>
                                            <Table.Td className="text-end font-mono tabular-nums">
                                                {row.amount > 0 ? '+' : ''}
                                                {money(row.amount)}
                                            </Table.Td>
                                            <Table.Td className="pe-4 text-end font-mono font-medium tabular-nums">
                                                {money(row.balance)}
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    </Card>
                )}
            </Stack>
        );

    return (
        <Stack gap="lg">
            <PageHeading
                eyebrow="Vue d’ensemble"
                title="Tableau de bord"
                description="Une lecture rapide de votre solde, des sommes à régler et des prochaines échéances."
                actions={
                    <>
                        <Button asChild variant="outline">
                            <Link to="/payments">Enregistrer un paiement</Link>
                        </Button>
                        <Button asChild>
                            <Link to="/charges">
                                <Plus aria-hidden="true" /> Nouvelle charge
                            </Link>
                        </Button>
                    </>
                }
            />
            <section aria-label="Résumé financier" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Solde du compte"
                    value={paid - total + refundTotal}
                    detail="Paiements + remboursements − charges"
                    icon={CircleDollarSign}
                />
                <MetricCard
                    label="Charges restantes"
                    value={outstanding}
                    detail="Montant encore à régler"
                    icon={Receipt}
                />
                <MetricCard
                    label="Crédit non affecté"
                    value={credit}
                    detail={`Paiements ${money(paymentCredit)} · remboursements ${money(refundCredit)}`}
                    icon={Wallet}
                />
                <MetricCard
                    label="Échéances en retard"
                    value={overdue}
                    detail="Selon les échéances enregistrées"
                    icon={Clock3}
                />
            </section>
            <div className="grid gap-4 xl:grid-cols-12">
                <Card p="lg" className="min-w-0 gap-5 xl:col-span-8">
                    <div>
                        <h2 className="font-semibold tracking-tight">Évolution du solde</h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Solde cumulé après chaque mouvement enregistré.
                        </p>
                    </div>
                    {rows.length === 0 ? (
                        <div className="bg-muted/40 text-muted-foreground grid min-h-56 place-items-center rounded-lg text-center text-sm">
                            Le graphique apparaîtra après l’enregistrement d’un premier mouvement.
                        </div>
                    ) : (
                        <div role="img" aria-label="Graphique de l’évolution du solde en euros">
                            <ResponsiveContainer width="100%" height={260}>
                                <RechartsLineChart
                                    accessibilityLayer
                                    data={rows.map(row => ({ date: displayDate(row.date), solde: row.balance / 100 }))}
                                    margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                                    <YAxis
                                        width={84}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={value => money(Number(value) * 100)}
                                    />
                                    <Tooltip formatter={value => [money(Number(value) * 100), 'Solde']} />
                                    <Line
                                        dataKey="solde"
                                        type="linear"
                                        stroke="var(--primary)"
                                        strokeWidth={2.5}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>
                <Card p="lg" className="min-w-0 gap-4 xl:col-span-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="font-semibold tracking-tight">Échéances à suivre</h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Les plus proches, selon vos échéanciers.
                            </p>
                        </div>
                        <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    </div>
                    {upcoming.length === 0 ? (
                        <div className="bg-muted/40 text-muted-foreground rounded-lg px-4 py-5 text-sm">
                            Aucune échéance restante n’est enregistrée.
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {upcoming.map(item => {
                                const isLate = item.date < today();
                                return (
                                    <li
                                        key={item.id}
                                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{item.title}</p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {displayDate(item.date)} · {isLate ? 'En retard' : 'À venir'}
                                            </p>
                                        </div>
                                        <p className="shrink-0 font-mono text-sm font-medium tabular-nums">
                                            {money(item.amount)}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <Button asChild variant="outline" className="mt-auto w-full">
                        <Link to="/charges">Consulter les charges</Link>
                    </Button>
                </Card>
            </div>
            <Card p="sm" className="min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-4 sm:px-4">
                    <div>
                        <h2 className="text-sm font-semibold">Derniers mouvements</h2>
                        <p className="text-muted-foreground mt-1 text-xs">Les cinq mouvements les plus récents.</p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                        <Link to="/ledger">Tout voir</Link>
                    </Button>
                </div>
                {recent.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-8 text-center text-sm">Aucun mouvement enregistré.</p>
                ) : (
                    <Table.ScrollContainer minWidth={540}>
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th className="ps-4">Date</Table.Th>
                                    <Table.Th>Nature</Table.Th>
                                    <Table.Th>Libellé</Table.Th>
                                    <Table.Th className="pe-4 text-end">Montant</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {recent.map(row => (
                                    <Table.Tr key={`${row.kind}-${row.id}`}>
                                        <Table.Td className="ps-4">{displayDate(row.date)}</Table.Td>
                                        <Table.Td>
                                            <Badge variant={row.kind === 'Charge' ? 'outline' : 'secondary'}>
                                                {row.kind}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td className="max-w-72 truncate">{row.label}</Table.Td>
                                        <Table.Td className="pe-4 text-end font-mono tabular-nums">
                                            {row.amount > 0 ? '+' : ''}
                                            {money(row.amount)}
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                )}
            </Card>
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
    const [desktopNavigation, setDesktopNavigation] = useState(() => matchMedia(desktopNavigationQuery).matches);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const mobileNavigationTrigger = useRef<HTMLButtonElement>(null);
    const client = useQueryClient();
    useEffect(() => {
        document.documentElement.classList.toggle('dark', colorScheme === 'dark');
        window.localStorage.setItem('charges-tba-color-scheme', colorScheme);
    }, [colorScheme]);
    useEffect(() => {
        const viewport = matchMedia(desktopNavigationQuery);
        function syncNavigation() {
            setDesktopNavigation(viewport.matches);
            if (viewport.matches) setOpened(false);
        }
        viewport.addEventListener('change', syncNavigation);
        syncNavigation();
        return () => viewport.removeEventListener('change', syncNavigation);
    }, []);
    function closeMobileNavigation() {
        mobileNavigationTrigger.current?.focus();
        setOpened(false);
    }
    useEffect(() => {
        if (!opened || desktopNavigation) return;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') closeMobileNavigation();
        }
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [opened, desktopNavigation]);
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
    const refunds = useQuery({
        queryKey: ['refunds', session.data?.user.id],
        queryFn: getRefunds,
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
    if (session.isPending)
        return (
            <main className="bg-background grid min-h-screen place-items-center p-6">
                <div className="text-muted-foreground flex items-center gap-3 text-sm" role="status">
                    <span className="border-primary size-5 animate-spin rounded-full border-2 border-e-transparent" />
                    Vérification de la session…
                </div>
            </main>
        );
    if (session.error)
        return (
            <main className="bg-background grid min-h-screen place-items-center p-6">
                <Alert color="red" className="max-w-lg" role="alert">
                    Impossible de vérifier la session. Vérifiez que le serveur fonctionne.
                </Alert>
            </main>
        );
    if (!session.data) return <Login />;
    const currentItem = navigationGroups.flatMap(group => group.items).find(item => item.path === location.pathname);
    return (
        <div
            className={`bg-muted/40 min-h-dvh md:grid md:gap-2 md:py-2 md:pe-2 motion-safe:md:transition-[grid-template-columns] motion-safe:md:duration-200 ${sidebarCollapsed ? 'md:grid-cols-[4.5rem_minmax(0,1fr)]' : 'md:grid-cols-[16rem_minmax(0,1fr)]'}`}>
            <div
                aria-hidden="true"
                className={`bg-foreground/30 fixed inset-0 z-30 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-200 md:hidden ${opened ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                onClick={closeMobileNavigation}
            />
            <AppNavigation
                pathname={location.pathname}
                mobileOpen={opened}
                desktop={desktopNavigation}
                collapsed={sidebarCollapsed}
                onNavigate={() => {
                    if (opened) closeMobileNavigation();
                }}
            />
            <div className="bg-card md:border-border/60 min-w-0 md:col-start-2 md:row-start-1 md:rounded-xl md:border">
                <header className="bg-card border-border/50 sticky top-0 z-40 flex min-h-16 items-center justify-between border-b px-4 md:top-2 md:rounded-t-xl md:px-6">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="subtle"
                            size="icon"
                            className="md:hidden"
                            ref={mobileNavigationTrigger}
                            aria-label={opened ? 'Fermer le menu' : 'Ouvrir le menu'}
                            aria-controls="primary-navigation"
                            aria-expanded={opened}
                            onClick={() => (opened ? closeMobileNavigation() : setOpened(true))}>
                            {opened ? <X /> : <Menu />}
                        </Button>
                        <Button
                            variant="subtle"
                            size="icon"
                            className="hidden md:inline-flex"
                            aria-label={sidebarCollapsed ? 'Développer la navigation' : 'Réduire la navigation'}
                            aria-controls="primary-navigation"
                            aria-expanded={!sidebarCollapsed}
                            onClick={() => setSidebarCollapsed(value => !value)}>
                            <PanelLeft aria-hidden="true" />
                        </Button>
                        <span aria-hidden="true" className="bg-border/70 h-4 w-px shrink-0" />
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground hidden sm:inline">ChargesTBA</span>
                            <span className="text-muted-foreground hidden sm:inline" aria-hidden="true">
                                /
                            </span>
                            <span className="font-medium">{currentItem?.label ?? 'Tableau de bord'}</span>
                        </div>
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
                            <Button type="submit" variant="subtle" className="gap-2" aria-label="Déconnexion">
                                <LogOut aria-hidden="true" /> <span className="hidden sm:inline">Déconnexion</span>
                            </Button>
                        </form>
                    </div>
                </header>
                <main className="min-w-0 p-4 sm:p-6 md:px-6 md:py-7 lg:px-8">
                    <div className="mx-auto w-full max-w-7xl">
                        {charges.isError || payments.isError || refunds.isError || settings.isError ? (
                            <Alert color="red" role="alert">
                                Impossible de charger les données.
                            </Alert>
                        ) : !charges.data || !payments.data || !refunds.data || !settings.data ? (
                            <div className="text-muted-foreground flex items-center gap-3 py-12 text-sm" role="status">
                                <span className="border-primary size-5 animate-spin rounded-full border-2 border-e-transparent" />
                                Chargement de vos données…
                            </div>
                        ) : (
                            <Suspense fallback={<Text>Chargement…</Text>}>
                                <Routes>
                                    <Route
                                        path="/"
                                        element={
                                            <Overview
                                                charges={charges.data}
                                                payments={payments.data}
                                                refunds={refunds.data}
                                            />
                                        }
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
                                        element={
                                            <Overview
                                                charges={charges.data}
                                                payments={payments.data}
                                                refunds={refunds.data}
                                                ledger
                                            />
                                        }
                                    />
                                    <Route
                                        path="/import"
                                        element={
                                            <ImportView
                                                categories={settings.data.categories}
                                                paymentTypes={settings.data.paymentTypes}
                                                templates={settings.data.templates}
                                            />
                                        }
                                    />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Suspense>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
