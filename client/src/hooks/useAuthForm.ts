import { useCallback, useState } from 'react';
import { ApiError } from '@/services';

export function useAuthForm() {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearErrors = useCallback(() => {
    setFormError(null);
    setFieldErrors({});
  }, []);

  const submit = useCallback(
    async (action: () => Promise<void>) => {
      clearErrors();
      setSubmitting(true);
      try {
        await action();
      } catch (error) {
        if (error instanceof ApiError) {
          setFormError(error.message);
          if (error.details?.length) {
            setFieldErrors(
              Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])),
            );
          }
        } else {
          setFormError('Something went wrong. Try again.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [clearErrors],
  );

  return { submitting, formError, fieldErrors, submit, clearErrors };
}
