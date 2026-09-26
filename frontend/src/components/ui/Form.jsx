import { useId } from 'react';
import clsx from 'clsx';

export function Field({ label, hint, error, required, children, className, htmlFor }) {
    return (
        <div className={clsx('min-w-0', className)}>
            {label ? <label className="cv-label mb-1.5" htmlFor={htmlFor}>{label}{required ? <span className="ml-1 text-danger">*</span> : null}</label> : null}
            {children}
            {hint && !error ? <p className="mt-1 text-[0.7rem] text-ink-500 dark:text-ink-400">{hint}</p> : null}
            {error ? <p className="mt-1 text-[0.7rem] font-semibold text-danger" role="alert">{error}</p> : null}
        </div>
    );
}

export function Input({ label, hint, error, required, className, id, ...rest }) {
    const generatedId = useId();
    const inputId = id || generatedId;
    return (
        <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={inputId}>
            <input id={inputId} className={clsx('cv-input', error && 'border-danger')} aria-invalid={error ? 'true' : undefined} required={required} {...rest} />
        </Field>
    );
}

export function Select({ label, hint, error, required, className, id, options = [], placeholder, children, ...rest }) {
    const generatedId = useId();
    const selectId = id || generatedId;
    return (
        <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={selectId}>
            <select id={selectId} className={clsx('cv-input', error && 'border-danger')} aria-invalid={error ? 'true' : undefined} required={required} {...rest}>
                {placeholder ? <option value="">{placeholder}</option> : null}
                {options.map((option) => {
                    const value = typeof option === 'string' ? option : option.value;
                    const text = typeof option === 'string' ? option : option.label;
                    return <option key={value} value={value}>{text}</option>;
                })}
                {children}
            </select>
        </Field>
    );
}

export function Textarea({ label, hint, error, required, className, id, rows = 3, ...rest }) {
    const generatedId = useId();
    const inputId = id || generatedId;
    return (
        <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={inputId}>
            <textarea id={inputId} rows={rows} className={clsx('cv-input resize-y', error && 'border-danger')} aria-invalid={error ? 'true' : undefined} required={required} {...rest} />
        </Field>
    );
}

export function Checkbox({ label, className, id, ...rest }) {
    const generatedId = useId();
    const inputId = id || generatedId;
    return (
        <div className={clsx('flex items-center gap-2', className)}>
            <input id={inputId} type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" {...rest} />
            <label htmlFor={inputId} className="text-sm text-ink-700 dark:text-ink-200">{label}</label>
        </div>
    );
}
