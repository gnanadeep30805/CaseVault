import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiErrorMessage } from '../lib/apiClient.js';

export function useResource(loader, deps = [], { enabled = true, initialData = null } = {}) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState(null);
    const loaderRef = useRef(loader);
    const mountedRef = useRef(true);

    loaderRef.current = loader;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const run = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return null;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await loaderRef.current();
            if (mountedRef.current) setData(result);
            return result;
        } catch (caught) {
            if (mountedRef.current) setError(caught);
            return null;
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        run();
    }, [run, ...deps]);

    return { data, setData, loading, error, reload: run, errorMessage: error ? apiErrorMessage(error) : null };
}

export function useMutation(mutator) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const mutate = useCallback(async (...args) => {
        setPending(true);
        setError(null);
        try {
            const result = await mutator(...args);
            return result;
        } catch (caught) {
            if (mountedRef.current) setError(caught);
            throw caught;
        } finally {
            if (mountedRef.current) setPending(false);
        }
    }, [mutator]);

    return { mutate, pending, error, errorMessage: error ? apiErrorMessage(error) : null, reset: () => setError(null) };
}

export function useDebounced(value, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

export function useDocumentTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} · CaseVault` : 'CaseVault';
    }, [title]);
}

export function useOnClickOutside(ref, handler, enabled = true) {
    useEffect(() => {
        if (!enabled) return undefined;
        const listener = (event) => {
            const node = ref.current;
            if (!node || node.contains(event.target)) return;
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler, enabled]);
}

export function getData(response) {
    return response?.data?.data;
}

export { api };
