import { LineChart } from '@mantine/charts';
import {
    Alert,
    Anchor,
    AppShell,
    Badge,
    Burger,
    Button,
    Card,
    Group,
    NavLink,
    NumberInput,
    PasswordInput,
    Progress,
    Stack,
    Table,
    Text,
    TextInput,
    Title,
    useMantineColorScheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAuthClient } from 'better-auth/react';
import { hc } from 'hono/client';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router';

import type { AppType } from '../server/app';
import { addMonths, splitCents } from '../shared/schedule';

import { ImportView } from './ImportView';

const auth = createAuthClient({ baseURL: window.location.origin });
const api = hc<AppType>('/');
const today = () => new Date().toLocaleDateString('en-CA');
const money = (cents: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
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
type Charge = Awaited<ReturnType<typeof getCharges>>[number];
type Payment = Awaited<ReturnType<typeof getPayments>>[number];

function Login() {
    const [signup, setSignup] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const form = useForm({ initialValues: { name: '', email: '', password: '' } });
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
        <main className="login">
            <Card withBorder radius="lg" p="xl">
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
                    <Anchor
                        component="button"
                        type="button"
                        onClick={() => {
                            setSignup(!signup);
                            setError('');
                        }}>
                        {signup ? 'J’ai déjà un compte' : 'Créer un compte'}
                    </Anchor>
                </Stack>
            </Card>
        </main>
    );
}

function ChargeForm({ onDone, charge }: { onDone: () => void; charge?: Charge }) {
    const client = useQueryClient();
    const [error, setError] = useState('');
    const form = useForm({
        initialValues: charge
            ? {
                  title: charge.title,
                  category: charge.category,
                  date: charge.date,
                  amount: (charge.amount / 100).toFixed(2),
                  installments: charge.installments,
              }
            : { title: '', category: 'Appel de fonds', date: today(), amount: '', installments: 1 },
    });
    const mutation = useMutation({
        mutationFn: async (values: typeof form.values) => {
            const json = { ...values, amount: cents(values.amount) };
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
                    <TextInput label="Catégorie" required {...form.getInputProps('category')} />
                    <TextInput
                        label="Date de la première échéance"
                        type="date"
                        required
                        {...form.getInputProps('date')}
                    />
                    <TextInput
                        label="Montant en euros"
                        placeholder="300,00"
                        required
                        inputMode="decimal"
                        {...form.getInputProps('amount')}
                    />
                    <NumberInput
                        label="Nombre d’échéances mensuelles"
                        min={1}
                        max={120}
                        required
                        {...form.getInputProps('installments')}
                    />
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

function ChargesView({ charges }: { charges: Charge[] }) {
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<Charge | null>(null);
    return (
        <Stack>
            <Group justify="space-between">
                <Title order={1}>Charges</Title>
                <Button onClick={() => setAdding(true)}>Ajouter une charge</Button>
            </Group>
            {adding && <ChargeForm onDone={() => setAdding(false)} />}
            {editing && <ChargeForm key={editing.id} charge={editing} onDone={() => setEditing(null)} />}
            {charges.length === 0 && <Text c="dimmed">Aucune charge pour le moment.</Text>}
            {charges.map(charge => (
                <Card withBorder radius="md" p="lg" key={charge.id}>
                    <Group justify="space-between">
                        <div>
                            <Text fw={600}>{charge.title}</Text>
                            <Text c="dimmed" size="sm">
                                {charge.category} · {charge.date}
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
    const form = useForm({ initialValues: { date: today(), category: 'Virement', amount: '' } });
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
                    <TextInput label="Date" type="date" required {...form.getInputProps('date')} />
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
                            const parts = splitCents(charge.amount, charge.installments);
                            let paid = charge.paid;
                            const next = parts.find(part => {
                                if (paid >= part) {
                                    paid -= part;
                                    return false;
                                }
                                return true;
                            });
                            const suggested = next === undefined ? 0 : next - paid;
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
                                    <Table.Td>{p.date}</Table.Td>
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
    const form = useForm({
        initialValues: {
            date: payment.date,
            category: payment.category,
            label: payment.label ?? '',
            amount: (payment.amount / 100).toFixed(2),
        },
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
                    <TextInput label="Date" type="date" required {...form.getInputProps('date')} />
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
        let remainingPaid = charge.paid;
        return (
            sum
            + splitCents(charge.amount, charge.installments).reduce((late, part, index) => {
                const applied = Math.min(remainingPaid, part);
                remainingPaid -= applied;
                return late + (addMonths(charge.date, index) < today() ? part - applied : 0);
            }, 0)
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
                                    <Table.Td>{row.date}</Table.Td>
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
            <div className="stats">
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
                    <LineChart
                        h={220}
                        data={rows.map(row => ({ date: row.date, solde: row.balance / 100 }))}
                        dataKey="date"
                        series={[{ name: 'solde', color: 'teal.6', label: 'Solde (€)' }]}
                        curveType="linear"
                    />
                </Card>
            )}
            <Text size="sm" c="dimmed">
                Les retards sont calculés selon les échéances mensuelles enregistrées.
            </Text>
        </Stack>
    );
}

export function App() {
    const session = auth.useSession();
    const { colorScheme, toggleColorScheme } = useMantineColorScheme();
    const location = useLocation();
    const [opened, { toggle, close }] = useDisclosure(false);
    const client = useQueryClient();
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
        ['/', 'Tableau de bord'],
        ['/charges', 'Charges'],
        ['/payments', 'Paiements'],
        ['/ledger', 'Mouvements'],
        ['/import', 'Importer'],
    ];
    return (
        <AppShell
            header={{ height: 64 }}
            navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            padding="xl">
            <AppShell.Header>
                <Group justify="space-between" h="100%" px="lg">
                    <Group>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
                        <Text fw={700}>ChargesTBA</Text>
                    </Group>
                    <Group>
                        <Button variant="subtle" onClick={() => toggleColorScheme()}>
                            {colorScheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                        </Button>
                        <form onSubmit={signOut}>
                            <Button type="submit" variant="subtle">
                                Déconnexion
                            </Button>
                        </form>
                    </Group>
                </Group>
            </AppShell.Header>
            <AppShell.Navbar p="md">
                {items.map(([path, label]) => (
                    <NavLink
                        key={path}
                        component={Link}
                        to={path}
                        label={label}
                        active={location.pathname === path}
                        onClick={close}
                    />
                ))}
            </AppShell.Navbar>
            <AppShell.Main>
                <div className="content">
                    {charges.isError || payments.isError ? (
                        <Alert color="red" role="alert">
                            Impossible de charger les données.
                        </Alert>
                    ) : !charges.data || !payments.data ? (
                        <Text>Chargement…</Text>
                    ) : (
                        <Routes>
                            <Route path="/" element={<Overview charges={charges.data} payments={payments.data} />} />
                            <Route path="/charges" element={<ChargesView charges={charges.data} />} />
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
                    )}
                </div>
            </AppShell.Main>
        </AppShell>
    );
}
