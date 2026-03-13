from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'assessment',
        'status',
        'created_at',
        'updated_at',
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['assessment__title', 'assessment__id']
    readonly_fields = ['created_at', 'updated_at', 'generated_at']
    ordering = ['-created_at']
