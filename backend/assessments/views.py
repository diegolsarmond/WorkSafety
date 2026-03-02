import hashlib
import json
from rest_framework import views, status, parsers
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import RiskAssessment, Evidence
from drf_spectacular.utils import extend_schema, extend_schema_view
from .serializers import EvidenceUploadSerializer, EvidenceSerializer

@extend_schema_view(
    post=extend_schema(
        summary="Upload Images (Evidences)",
        description="Uploads up to 10 images with an optional ISO 8601 timestamp for a RiskAssessment. Ensures idempotency based on standard hashing (SHA-256) of each image.",
        request=EvidenceUploadSerializer,
        responses={201: EvidenceSerializer(many=True)},
    )
)
class EvidenceUploadView(views.APIView):
    parser_classes = (parsers.MultiPartParser, parsers.FormParser)
    
    def post(self, request, assessment_id, *args, **kwargs):
        assessment = get_object_or_404(RiskAssessment, id=assessment_id)
        
        serializer = EvidenceUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        images = serializer.validated_data['images']
        timestamps = serializer.validated_data.get('timestamps', [])
        
        created_evidences = []
        for i, image in enumerate(images):
            timestamp = timestamps[i] if timestamps else None
            
            # Read image content for hash to check idempotency
            image_content = image.read()
            file_hash = hashlib.sha256(image_content).hexdigest()
            image.seek(0) # Reset file pointer after reading
            
            # Idempotency check: if evidence with this hash already exists for this assessment, return it instead of duplicating
            existing_evidence = Evidence.objects.filter(assessment=assessment, file_hash=file_hash).first()
            if existing_evidence:
                created_evidences.append(existing_evidence)
                continue
                
            # Create new evidence
            new_evidence = Evidence(
                assessment=assessment,
                file=image
            )
            # If we need to save the timestamp we extracted, we'll wait for a model update.
            # Currently the model Evidence doesn't have a place for extracted timestamp,
            # but we can validate it as per requirements.
            new_evidence.save() # This triggers _compute_file_metadata and saves the hash
            created_evidences.append(new_evidence)
            
        result_serializer = EvidenceSerializer(created_evidences, many=True)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)
