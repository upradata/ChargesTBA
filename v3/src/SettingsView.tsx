import { useQueryClient } from '@tanstack/react-query';
import { hc } from 'hono/client';
import { useState, type FormEvent } from 'react';

import type { AppType } from '../server/app';
import type { ScheduleRule } from '../shared/schedule';

import type { Settings } from './App';
import {
    Alert,
    Button,
    Card,
    Group,
    NumberInput,
    Select,
    Stack,
    Text,
    TextInput,
    Title,
} from './components/ui/primitives';

const api = hc<AppType>('/');
async function check(res: Response) {
    if (res.ok) return;
    const body: unknown = await res.json();
    throw new Error(
        typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'La requête a échoué.',
    );
}

function CategoryEditor({
    category,
    templates,
    done,
}: {
    category?: Settings['categories'][number];
    templates: Settings['templates'];
    done: () => void;
}) {
    const [name, setName] = useState(category?.name ?? '');
    const [template, setTemplate] = useState<string | null>(category?.defaultScheduleId ?? null);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    async function submit(event: FormEvent) {
        event.preventDefault();
        setPending(true);
        setError('');
        try {
            const json = { name, defaultScheduleId: template };
            await check(
                category
                    ? await api.api.categories[':id'].$put({ param: { id: category.id }, json })
                    : await api.api.categories.$post({ json }),
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
                    <Title order={3}>{category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</Title>
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
                    <Select
                        label="Échéancier par défaut"
                        clearable
                        value={template}
                        onChange={setTemplate}
                        placeholder="Paiement unique"
                        data={templates.map(item => ({ value: item.id, label: item.name }))}
                    />
                    <Group>
                        <Button type="submit" loading={pending}>
                            Enregistrer
                        </Button>
                        <Button variant="subtle" onClick={done}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

function TemplateEditor({ template, done }: { template?: Settings['templates'][number]; done: () => void }) {
    const [name, setName] = useState(template?.name ?? '');
    const [rules, setRules] = useState<ScheduleRule[]>(template?.rules ?? [{ monthOffset: 1, day: 1, weight: 1 }]);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    function update(index: number, field: keyof ScheduleRule, value: string | number) {
        setRules(current => current.map((item, i) => (i === index ? { ...item, [field]: Number(value) } : item)));
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        setPending(true);
        setError('');
        try {
            const json = { name, rules };
            await check(
                template
                    ? await api.api.templates[':id'].$put({ param: { id: template.id }, json })
                    : await api.api.templates.$post({ json }),
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
                    <Title order={3}>{template ? 'Modifier l’échéancier' : 'Nouvel échéancier'}</Title>
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
                    <Text size="sm" c="dimmed">
                        Chaque échéance est relative au mois de la charge. Les parts déterminent la répartition du
                        montant.
                    </Text>
                    {rules.map((rule, index) => (
                        <Group key={index} align="end">
                            <NumberInput
                                label="Mois après la charge"
                                min={0}
                                max={120}
                                required
                                value={rule.monthOffset}
                                onChange={value => update(index, 'monthOffset', value)}
                            />
                            <NumberInput
                                label="Jour du mois"
                                min={1}
                                max={31}
                                required
                                value={rule.day}
                                onChange={value => update(index, 'day', value)}
                            />
                            <NumberInput
                                label="Part"
                                min={1}
                                max={10000}
                                required
                                value={rule.weight}
                                onChange={value => update(index, 'weight', value)}
                            />
                            <Button
                                type="button"
                                variant="subtle"
                                disabled={rules.length === 1}
                                onClick={() => setRules(current => current.filter((_, i) => i !== index))}>
                                Supprimer
                            </Button>
                        </Group>
                    ))}
                    <Group>
                        <Button
                            type="button"
                            variant="light"
                            disabled={rules.length >= 120}
                            onClick={() =>
                                setRules(current => [
                                    ...current,
                                    { monthOffset: current.length + 1, day: 1, weight: 1 },
                                ])
                            }>
                            Ajouter une échéance
                        </Button>
                    </Group>
                    <Group>
                        <Button type="submit" loading={pending}>
                            Enregistrer
                        </Button>
                        <Button variant="subtle" onClick={done}>
                            Annuler
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}

export function SettingsView({ settings }: { settings: Settings }) {
    const client = useQueryClient();
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
    const [error, setError] = useState('');
    function done() {
        setEditingCategory(null);
        setEditingTemplate(null);
        void client.invalidateQueries({ queryKey: ['settings'] });
    }
    async function remove(kind: 'category' | 'template', id: string) {
        if (!window.confirm('Supprimer cet élément ? Les charges existantes ne seront pas modifiées.')) return;
        setError('');
        try {
            await check(
                kind === 'category'
                    ? await api.api.categories[':id'].$delete({ param: { id } })
                    : await api.api.templates[':id'].$delete({ param: { id } }),
            );
            done();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Suppression impossible.');
        }
    }
    return (
        <Stack>
            <Title order={1}>Paramètres</Title>
            {error && (
                <Alert color="red" role="alert">
                    {error}
                </Alert>
            )}
            <Group justify="space-between">
                <Title order={2}>Catégories</Title>
                <Button onClick={() => setEditingCategory('new')}>Ajouter une catégorie</Button>
            </Group>
            {editingCategory && (
                <CategoryEditor
                    key={editingCategory}
                    category={settings.categories.find(item => item.id === editingCategory)}
                    templates={settings.templates}
                    done={done}
                />
            )}
            {settings.categories.map(category => (
                <Card withBorder key={category.id}>
                    <Group justify="space-between">
                        <div>
                            <Text fw={600}>{category.name}</Text>
                            <Text size="sm" c="dimmed">
                                {settings.templates.find(item => item.id === category.defaultScheduleId)?.name
                                    ?? 'Paiement unique'}
                            </Text>
                        </div>
                        <Group>
                            <Button variant="subtle" onClick={() => setEditingCategory(category.id)}>
                                Modifier
                            </Button>
                            <Button variant="subtle" color="red" onClick={() => void remove('category', category.id)}>
                                Supprimer
                            </Button>
                        </Group>
                    </Group>
                </Card>
            ))}
            <Group justify="space-between">
                <Title order={2}>Échéanciers réutilisables</Title>
                <Button onClick={() => setEditingTemplate('new')}>Ajouter un échéancier</Button>
            </Group>
            {editingTemplate && (
                <TemplateEditor
                    key={editingTemplate}
                    template={settings.templates.find(item => item.id === editingTemplate)}
                    done={done}
                />
            )}
            {settings.templates.map(template => (
                <Card withBorder key={template.id}>
                    <Group justify="space-between">
                        <div>
                            <Text fw={600}>{template.name}</Text>
                            <Text size="sm" c="dimmed">
                                {template.rules.length} échéance(s)
                            </Text>
                        </div>
                        <Group>
                            <Button variant="subtle" onClick={() => setEditingTemplate(template.id)}>
                                Modifier
                            </Button>
                            <Button variant="subtle" color="red" onClick={() => void remove('template', template.id)}>
                                Supprimer
                            </Button>
                        </Group>
                    </Group>
                </Card>
            ))}
        </Stack>
    );
}
