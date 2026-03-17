# Test report generation to find the exact error
from reports.models import Report
from reports.tasks import _collect_assessment_data, _generate_pdf_document
import traceback

try:
    print("Testing report generation for Report 99...")
    report = Report.objects.get(id=99)
    assessment = report.assessment
    print(f"✓ Assessment loaded: {assessment}")
    
    print("\nStep 1: Collect assessment data...")
    data = _collect_assessment_data(assessment)
    print(f"✓ Data collected, keys: {len(data)} items")
    
    print("\nStep 2: Generate PDF document...")
    pdf_buffer = _generate_pdf_document(assessment, data)
    print(f"✓ PDF generated, buffer size: {pdf_buffer.getbuffer().nbytes} bytes")
    
    print("\n✓ SUCCESS!")
    
except Exception as e:
    print(f"\n✗ ERROR: {type(e).__name__}: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
