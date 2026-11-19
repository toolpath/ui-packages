from enum import Enum


class PlanToolSourceSynthesizedKind(str, Enum):
    SYNTHESIZED = "synthesized"

    def __str__(self) -> str:
        return str(self.value)
