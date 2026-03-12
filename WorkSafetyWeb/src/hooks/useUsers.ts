import { useState, useEffect, useCallback } from 'react';
import { userService, User, CreateUserData, UpdateUserData, ApiError } from '../services/api';

interface UseUsersReturn {
  users: User[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (data: CreateUserData) => Promise<User>;
  updateUser: (id: number, data: UpdateUserData) => Promise<User>;
  deactivateUser: (id: number) => Promise<void>;
  activateUser: (id: number) => Promise<void>;
  clearError: () => void;
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.list();
      setUsers(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao carregar usuários');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createUser = useCallback(async (data: CreateUserData): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const newUser = await userService.create(data);
      setUsers(prev => [...prev, newUser]);
      return newUser;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao criar usuário');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback(async (id: number, data: UpdateUserData): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await userService.update(id, data);
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
      return updated;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao atualizar usuário');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deactivateUser = useCallback(async (id: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await userService.deactivate(id);
      setUsers(prev => prev.map(u => 
        u.id === id ? { ...u, is_active: false, isActive: false } : u
      ));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao desativar usuário');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activateUser = useCallback(async (id: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await userService.activate(id);
      setUsers(prev => prev.map(u => 
        u.id === id ? { ...u, is_active: true, isActive: true } : u
      ));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao ativar usuário');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Carrega usuários automaticamente no primeiro render
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deactivateUser,
    activateUser,
    clearError,
  };
}
