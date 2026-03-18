#!/usr/bin/env python
"""Debug script to identify report generation issue."""
import os
import sys
import django
import traceback

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from reports.tasks import _collect_assessment_data
from assessments.models import RiskAssessment

try:
    print("Fetching assessment 69...")
    a = RiskAssessment.objects.get(id=69)
    print(f"✓ Assessment: {a}")
    print(f"✓ Created_by: {a.created_by}")
    print(f"✓ Environment type: {a.environment_type}")
    
    print("\nStarting data collection...")
    data = _collect_assessment_data(a)
    print(f"✓ Success! Keys: {list(data.keys())}")
    
except Exception as e:
    print(f"\n✗ Error: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
    sys.exit(1)
