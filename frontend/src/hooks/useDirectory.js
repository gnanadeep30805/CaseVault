import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiErrorStatus, unwrap } from '../lib/apiClient.js';

function useDirectoryResource(loader, deps = [], { enabled = true } = {}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);
    const [restricted, setRestricted] = useState(false);
    const loaderRef = useRef(loader);
    loaderRef.current = loader;

    const reload = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await loaderRef.current();
            setItems(Array.isArray(result) ? result : []);
            setRestricted(false);
        } catch (caught) {
            if (apiErrorStatus(caught) === 403) {
                setRestricted(true);
                setItems([]);
            } else {
                setError(caught);
            }
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        reload();
    }, [reload, ...deps]);

    return { items, loading, error, restricted, reload };
}

export function useUsers(enabled = true) {
    const loader = useCallback(() => api.get('/users').then(unwrap), []);
    const { items, loading, error, restricted, reload } = useDirectoryResource(loader, [], { enabled });
    return { users: items, loading, error, restricted, reload };
}

export function useDepartments(enabled = true) {
    const loader = useCallback(() => api.get('/departments').then(unwrap), []);
    const { items, loading, error, reload } = useDirectoryResource(loader, [], { enabled });
    return { departments: items, loading, error, reload };
}

export function useRoles(enabled = true) {
    const loader = useCallback(() => api.get('/roles').then(unwrap), []);
    const { items, loading, error, reload } = useDirectoryResource(loader, [], { enabled });
    return { roles: items, loading, error, reload };
}
