from reports.models import Report
from assessments.models import RiskAssessment
from reports.tasks import generate_report
import time

print('Creating report for regeneration test...')
assessment = RiskAssessment.objects.get(id=69)

report = Report.objects.create(
    assessment=assessment,
    status='generating',
)
print(f'✓ Created Report {report.id}')

print('Triggering Celery task...')
task = generate_report.delay(report.id)
print(f'✓ Task {task.id} sent to Celery')

print('Waiting for task to complete...')
time.sleep(4)

report.refresh_from_db()
print(f'Report status: {report.status}')
if report.status == 'ready':
    print(f'✓✓✓ REPORT GENERATED SUCCESSFULLY!')
    print(f'  File: {report.file.name if report.file else "No file"}')
    print(f'  Time: {report.generation_time_seconds}s')
else:
    print(f'✗ Status: {report.status}')
    if report.error_message:
        print(f'  Error: {report.error_message[:200]}')
