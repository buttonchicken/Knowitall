from pydantic import BaseModel, Field
from typing import List

class SalesResearchReport(BaseModel):
    company_overview: str = Field()
    products_and_services: List[str] = Field()
    target_customers: List[str] = Field()
    business_signals: List[str] = Field()
    risks_and_challenges: List[str] = Field()
    suggested_discovery_questions: List[str] = Field()
    suggested_outreach_strategy: str = Field()
    unknowns: List[str] = Field()
    sources: List[str] = Field()