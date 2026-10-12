import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services';
import { useAuth } from './useAuth';
import type { ChangePasswordPayload, UpdateProfilePayload } from '@/types';

export function useProfileMutations() {
  const { setUser } = useAuth();

  const updateProfile = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => authService.updateProfile(payload),
    onSuccess: (user) => setUser(user),
  });

  const changePassword = useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authService.changePassword(payload),
  });

  return { updateProfile, changePassword };
}
