import { useState, type ChangeEvent, type SyntheticEvent } from 'react';

type StringFields<T> = Record<keyof T, string>;

export function useFormState<T extends StringFields<T>>(initialValues: T) {
    const [values, setValues] = useState(initialValues);

    function setFieldValue(field: keyof T, value: string) {
        setValues(current => ({ ...current, [field]: value }) as T);
    }

    function getInputProps<K extends keyof T>(field: K) {
        return {
            value: values[field],
            onChange: (event: ChangeEvent<HTMLInputElement>) => setFieldValue(field, event.currentTarget.value),
        };
    }

    function onSubmit(handler: (values: T) => void) {
        return (event: SyntheticEvent<HTMLFormElement>) => {
            event.preventDefault();
            handler(values);
        };
    }

    return { values, setFieldValue, getInputProps, onSubmit };
}
