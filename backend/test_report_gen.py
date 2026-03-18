#!/usr/bin/env python
"""Test script for report generation debugging."""

if __name__ == '__main__':
    import os
    import sys
    import django
    
    # Setup Django
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

    from reports.tasks import generate_report

    try:
        print("Running generate_report(99)...")
        result = generate_report(99)
        print("Result:", result)
    except Exception as e:
        import traceback
        print("\nError occurred:")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {e}")
        print("\nFull traceback:")
        traceback.print_exc()
