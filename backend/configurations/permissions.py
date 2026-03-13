"""
Permissões personalizadas para o app configurations.
"""
from rest_framework import permissions


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permissão que permite leitura para usuários autenticados,
    mas requer permissão de administrador para modificações.
    """
    
    def has_permission(self, request, view):
        # Requer autenticação para qualquer acesso
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Permite leitura (GET, HEAD, OPTIONS) para qualquer usuário autenticado
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Requer is_staff ou is_superuser para modificações
        return request.user.is_staff or request.user.is_superuser
