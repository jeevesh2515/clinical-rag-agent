from app.models import IngestSource

DEFAULT_SOURCES = [
    IngestSource(
        source_id="nice-ng136",
        title="Hypertension in adults: diagnosis and management",
        url="https://www.nice.org.uk/guidance/ng136/resources/hypertension-in-adults-diagnosis-and-management-pdf-66141722710213",
        organization="National Institute for Health and Care Excellence",
        publication_year=2019,
        version="NG136",
        source_type="clinical_guideline",
        review_date="2024-01-01",
        effective_date="2019-08-28",
        license_notes="NICE guidelines are published under the NICE Open Access and can be reproduced for educational purposes.",
    ),
    IngestSource(
        source_id="who-hypertension-pharmacological",
        title="Guideline for the pharmacological treatment of hypertension in adults",
        url="https://iris.who.int/bitstreams/f062769d-f075-4a00-87af-0a2106e0bd04/download",
        organization="World Health Organization",
        publication_year=2021,
        source_type="clinical_guideline",
        effective_date="2021-08-25",
        license_notes="WHO guidelines are available under the CC BY-NC-SA 3.0 IGO license.",
    ),
    IngestSource(
        source_id="cdc-community-clinical-linkages",
        title="Community-Clinical Linkages for the Prevention and Control of Chronic Diseases",
        url="https://www.cdc.gov/high-blood-pressure/docs/CCL-Practitioners-Guide.pdf",
        organization="U.S. Centers for Disease Control and Prevention",
        publication_year=2020,
        source_type="clinical_guideline",
        review_date="2025-01-01",
        effective_date="2020-03-01",
        license_notes="U.S. government publication. Public domain.",
    ),
]
