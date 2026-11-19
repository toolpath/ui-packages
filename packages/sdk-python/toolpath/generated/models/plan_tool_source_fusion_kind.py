from enum import Enum


class PlanToolSourceFusionKind(str, Enum):
    FUSION = "fusion"

    def __str__(self) -> str:
        return str(self.value)
