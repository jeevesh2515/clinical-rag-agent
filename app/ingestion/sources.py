from app.models import IngestSource

DEFAULT_SOURCES = [
    IngestSource(
        source_id="nice-ng136",
        title="Hypertension in adults: diagnosis and management",
        url="https://www.nice.org.uk/guidance/ng136/resources/hypertension-in-adults-diagnosis-and-management-pdf-66141722710213",
        organization="National Institute for Health and Care Excellence",
        publication_year=2019,
        version="NG136",
    ),
    IngestSource(
        source_id="who-hypertension-pharmacological",
        title="Guideline for the pharmacological treatment of hypertension in adults",
        url="https://iris.who.int/bitstreams/f062769d-f075-4a00-87af-0a2106e0bd04/download",
        organization="World Health Organization",
        publication_year=2021,
    ),
    IngestSource(
        source_id="cdc-community-clinical-linkages",
        title="Community-Clinical Linkages for the Prevention and Control of Chronic Diseases",
        url="https://www.cdc.gov/high-blood-pressure/docs/CCL-Practitioners-Guide.pdf",
        organization="U.S. Centers for Disease Control and Prevention",
        publication_year=2020,
    ),
]
