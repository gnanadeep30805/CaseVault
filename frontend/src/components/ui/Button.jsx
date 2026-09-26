import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
    primary: 'cv-btn-primary',
    blue: 'cv-btn-blue',
    secondary: 'cv-btn-secondary',
    ghost: 'cv-btn-ghost',
    danger: 'cv-btn-danger',
};

const SIZES = {
    sm: 'cv-btn-sm',
    md: '',
};

export default function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    icon: Icon,
    children,
    className,
    ...rest
}) {
    return (
        <button
            type={type}
            className={clsx('cv-btn', VARIANTS[variant] || VARIANTS.primary, SIZES[size], className)}
            disabled={disabled || loading}
            {...rest}
        >
            {loading ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" aria-hidden="true" /> : null}
            {Icon && !loading ? <Icon size={size === 'sm' ? 13 : 15} aria-hidden="true" /> : null}
            {children}
        </button>
    );
}
