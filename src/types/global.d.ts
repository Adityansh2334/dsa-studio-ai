export {};

declare global {
    type Nullable<T> = T | null;
    
    function showToast(message: string, type?: 'success' | 'error' | 'info' | 'warning'): void;

}
