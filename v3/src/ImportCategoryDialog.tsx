import { Plus, Search } from 'lucide-react';
import { useId, useState } from 'react';

import type { ImportCategory, ImportCategoryResolution } from '../server/import-csv';

import { Button, Dialog, TextInput } from './components/ui/primitives';
import { displayLine } from './importAttribution';

export type CategoryEditTarget = {
    label: string;
    targetKind: 'charge' | 'payment';
    rows: number[];
    current: string | null;
};

type Choice = { kind: 'auto' } | { kind: 'existing'; id: string } | { kind: 'new' };

const optionClass =
    'has-[:checked]:border-primary/50 has-[:checked]:bg-accent/60 has-[:focus-visible]:ring-ring/50 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm has-[:focus-visible]:ring-[3px]';

export function ImportCategoryDialog({
    target,
    resolution,
    options,
    templates,
    onApply,
    onClose,
}: {
    target: CategoryEditTarget;
    resolution: ImportCategoryResolution | undefined;
    options: ImportCategory[];
    templates: { id: string; name: string }[];
    onApply: (resolution: ImportCategoryResolution | null) => void;
    onClose: () => void;
}) {
    const isPayment = target.targetKind === 'payment';
    const [choice, setChoice] = useState<Choice>(
        resolution?.kind === 'existing'
            ? { kind: 'existing', id: resolution.categoryId }
            : resolution?.kind === 'new'
              ? { kind: 'new' }
              : { kind: 'auto' },
    );
    const [name, setName] = useState(resolution?.kind === 'new' ? resolution.name : target.label.trim().slice(0, 80));
    const [scheduleId, setScheduleId] = useState(resolution?.kind === 'new' ? resolution.defaultScheduleId : null);
    const [filter, setFilter] = useState('');
    const groupName = useId();
    const scheduleFieldId = useId();
    const query = filter.trim().toLowerCase();
    const visible = query ? options.filter(item => item.name.toLowerCase().includes(query)) : options;
    const lines = target.rows.map(displayLine);
    const invalid = choice.kind === 'new' && !name.trim();

    function apply() {
        if (choice.kind === 'auto') onApply(null);
        else if (choice.kind === 'existing')
            onApply({ label: target.label, kind: 'existing', categoryId: choice.id, targetKind: target.targetKind });
        else onApply({ label: target.label, kind: 'new', name: name.trim(), defaultScheduleId: scheduleId });
    }

    return (
        <Dialog
            open
            onClose={onClose}
            title={isPayment ? 'Type de paiement' : 'Catégorie'}
            description={
                <>
                    Libellé « {target.label} » · s’applique{' '}
                    {lines.length > 1 ? `aux ${lines.length} lignes` : 'à la ligne'} {lines.join(', ')}.
                </>
            }
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Annuler
                    </Button>
                    <Button disabled={invalid} onClick={apply}>
                        Valider
                    </Button>
                </>
            }>
            <fieldset className="grid gap-2">
                <legend className="sr-only">
                    {isPayment ? 'Choisir un type de paiement' : 'Choisir une catégorie'}
                </legend>
                {options.length > 6 && (
                    <TextInput
                        aria-label="Filtrer la liste"
                        placeholder="Filtrer…"
                        value={filter}
                        onChange={event => setFilter(event.currentTarget.value)}
                        endAction={<Search className="text-muted-foreground me-2 size-4" aria-hidden="true" />}
                    />
                )}
                <label className={optionClass}>
                    <input
                        type="radio"
                        name={groupName}
                        className="accent-primary"
                        checked={choice.kind === 'auto'}
                        onChange={() => setChoice({ kind: 'auto' })}
                    />
                    <span className="min-w-0">
                        <span className="block">Automatique</span>
                        <span className="text-muted-foreground block text-xs">
                            {isPayment
                                ? 'Règles CSV ou « Paiement importé »'
                                : 'Règles CSV ou nom de catégorie identique'}
                        </span>
                    </span>
                </label>
                <div className="grid max-h-64 gap-2 overflow-y-auto">
                    {visible.map(item => (
                        <label key={item.id} className={optionClass}>
                            <input
                                type="radio"
                                name={groupName}
                                className="accent-primary"
                                checked={choice.kind === 'existing' && choice.id === item.id}
                                onChange={() => setChoice({ kind: 'existing', id: item.id })}
                            />
                            <span className="min-w-0 break-words">{item.name}</span>
                        </label>
                    ))}
                    {visible.length === 0 && (
                        <p className="text-muted-foreground px-3 py-2 text-sm">
                            {options.length ? 'Aucun résultat.' : 'Aucun élément existant.'}
                        </p>
                    )}
                </div>
                {!isPayment && (
                    <div className="grid gap-3 rounded-md border border-dashed p-3">
                        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                            <input
                                type="radio"
                                name={groupName}
                                className="accent-primary"
                                checked={choice.kind === 'new'}
                                onChange={() => setChoice({ kind: 'new' })}
                            />
                            <Plus className="size-4" aria-hidden="true" />
                            Créer une catégorie
                        </label>
                        {choice.kind === 'new' && (
                            <>
                                <TextInput
                                    label="Nom de la catégorie"
                                    required
                                    maxLength={80}
                                    value={name}
                                    onChange={event => setName(event.currentTarget.value)}
                                />
                                <div className="grid gap-1.5">
                                    <label htmlFor={scheduleFieldId} className="text-sm font-medium">
                                        Échéancier par défaut (facultatif)
                                    </label>
                                    <select
                                        id={scheduleFieldId}
                                        value={scheduleId ?? ''}
                                        onChange={event => setScheduleId(event.currentTarget.value || null)}
                                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]">
                                        <option value="">Aucun échéancier</option>
                                        {templates.map(template => (
                                            <option key={template.id} value={template.id}>
                                                {template.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    La catégorie ne sera enregistrée qu’à la confirmation de l’import.
                                </p>
                            </>
                        )}
                    </div>
                )}
            </fieldset>
        </Dialog>
    );
}
