from enum import Enum


class PlanSummaryMaterial(str, Enum):
    ALUMINUM = "Aluminum"
    LOWCARBONSTEEL = "LowCarbonSteel"
    STAINLESSSTEEL = "StainlessSteel"

    def __str__(self) -> str:
        return str(self.value)
